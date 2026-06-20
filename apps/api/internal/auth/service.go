// Package auth provides registration, login, and token management.
package auth

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/MorrisMorrison/granite/apps/api/internal/apperr"
	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
)

// Service implements the auth use-cases over the data store.
type Service struct {
	q                 *sqlc.Queries
	tokens            *TokenManager
	allowRegistration bool
	now               func() time.Time
}

// NewService constructs an auth Service.
func NewService(q *sqlc.Queries, tokens *TokenManager, allowRegistration bool) *Service {
	return &Service{q: q, tokens: tokens, allowRegistration: allowRegistration, now: time.Now}
}

// User is the client-facing user representation (no password hash).
type User struct {
	ID          string          `json:"id"`
	Email       string          `json:"email"`
	DisplayName string          `json:"display_name"`
	Settings    json.RawMessage `json:"settings"`
	CreatedAt   int64           `json:"created_at"`
	UpdatedAt   int64           `json:"updated_at"`
}

// TokenPair is an access + refresh token pair.
type TokenPair struct {
	Access  string `json:"access"`
	Refresh string `json:"refresh"`
}

func toUser(u sqlc.User) User {
	return User{
		ID:          u.ID,
		Email:       u.Email,
		DisplayName: u.DisplayName,
		Settings:    json.RawMessage(u.Settings),
		CreatedAt:   u.CreatedAt,
		UpdatedAt:   u.UpdatedAt,
	}
}

// Register creates a new account (if registration is enabled) and returns the
// user plus a fresh token pair.
func (s *Service) Register(ctx context.Context, email, password, displayName string) (User, TokenPair, error) {
	if !s.allowRegistration {
		return User{}, TokenPair{}, apperr.Forbidden("registration is disabled")
	}
	email = normalizeEmail(email)
	if err := validateCredentials(email, password); err != nil {
		return User{}, TokenPair{}, err
	}

	if _, err := s.q.GetUserByEmail(ctx, email); err == nil {
		return User{}, TokenPair{}, apperr.Conflict("an account with that email already exists")
	} else if !errors.Is(err, sql.ErrNoRows) {
		return User{}, TokenPair{}, err
	}

	hash, err := HashPassword(password)
	if err != nil {
		return User{}, TokenPair{}, err
	}
	now := s.now().UnixMilli()
	u, err := s.q.CreateUser(ctx, sqlc.CreateUserParams{
		ID:           uuid.NewString(),
		Email:        email,
		PasswordHash: hash,
		DisplayName:  strings.TrimSpace(displayName),
		Settings:     "{}",
		CreatedAt:    now,
		UpdatedAt:    now,
	})
	if err != nil {
		return User{}, TokenPair{}, err
	}
	pair, err := s.issueTokens(ctx, u.ID)
	if err != nil {
		return User{}, TokenPair{}, err
	}
	return toUser(u), pair, nil
}

// Login verifies credentials and returns the user plus a fresh token pair.
func (s *Service) Login(ctx context.Context, email, password string) (User, TokenPair, error) {
	u, err := s.q.GetUserByEmail(ctx, normalizeEmail(email))
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, TokenPair{}, apperr.Unauthorized("invalid email or password")
	} else if err != nil {
		return User{}, TokenPair{}, err
	}
	ok, err := VerifyPassword(password, u.PasswordHash)
	if err != nil || !ok {
		return User{}, TokenPair{}, apperr.Unauthorized("invalid email or password")
	}
	pair, err := s.issueTokens(ctx, u.ID)
	if err != nil {
		return User{}, TokenPair{}, err
	}
	return toUser(u), pair, nil
}

// Refresh rotates a refresh token: it validates the presented token, revokes it,
// and issues a new pair. Reuse of an already-revoked token revokes the whole
// session family (theft defense).
func (s *Service) Refresh(ctx context.Context, refresh string) (TokenPair, error) {
	rt, err := s.q.GetRefreshTokenByHash(ctx, HashRefreshToken(refresh))
	if errors.Is(err, sql.ErrNoRows) {
		return TokenPair{}, apperr.Unauthorized("invalid refresh token")
	} else if err != nil {
		return TokenPair{}, err
	}
	now := s.now()
	if rt.RevokedAt.Valid {
		_ = s.q.RevokeAllUserRefreshTokens(ctx, sqlc.RevokeAllUserRefreshTokensParams{
			RevokedAt: nullMillis(now), UserID: rt.UserID,
		})
		return TokenPair{}, apperr.Unauthorized("refresh token has been revoked")
	}
	if now.UnixMilli() >= rt.ExpiresAt {
		return TokenPair{}, apperr.Unauthorized("refresh token has expired")
	}
	if err := s.q.RevokeRefreshToken(ctx, sqlc.RevokeRefreshTokenParams{RevokedAt: nullMillis(now), ID: rt.ID}); err != nil {
		return TokenPair{}, err
	}
	return s.issueTokens(ctx, rt.UserID)
}

// Logout revokes the presented refresh token. It is idempotent.
func (s *Service) Logout(ctx context.Context, refresh string) error {
	rt, err := s.q.GetRefreshTokenByHash(ctx, HashRefreshToken(refresh))
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	} else if err != nil {
		return err
	}
	return s.q.RevokeRefreshToken(ctx, sqlc.RevokeRefreshTokenParams{RevokedAt: nullMillis(s.now()), ID: rt.ID})
}

// GetUser returns the user by id.
func (s *Service) GetUser(ctx context.Context, id string) (User, error) {
	u, err := s.q.GetUserByID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, apperr.NotFound("user not found")
	} else if err != nil {
		return User{}, err
	}
	return toUser(u), nil
}

// UpdateProfile updates the user's display name and/or settings (PATCH semantics:
// nil fields are left unchanged).
func (s *Service) UpdateProfile(ctx context.Context, id string, displayName *string, settings json.RawMessage) (User, error) {
	cur, err := s.q.GetUserByID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, apperr.NotFound("user not found")
	} else if err != nil {
		return User{}, err
	}
	dn := cur.DisplayName
	if displayName != nil {
		dn = strings.TrimSpace(*displayName)
	}
	st := cur.Settings
	if settings != nil {
		if !json.Valid(settings) {
			return User{}, apperr.Validation("settings must be valid JSON")
		}
		st = string(settings)
	}
	u, err := s.q.UpdateUserProfile(ctx, sqlc.UpdateUserProfileParams{
		DisplayName: dn, Settings: st, UpdatedAt: s.now().UnixMilli(), ID: id,
	})
	if err != nil {
		return User{}, err
	}
	return toUser(u), nil
}

func (s *Service) issueTokens(ctx context.Context, userID string) (TokenPair, error) {
	now := s.now()
	access, err := s.tokens.GenerateAccessToken(userID, now)
	if err != nil {
		return TokenPair{}, err
	}
	refresh, err := GenerateRefreshToken()
	if err != nil {
		return TokenPair{}, err
	}
	if _, err := s.q.CreateRefreshToken(ctx, sqlc.CreateRefreshTokenParams{
		ID:        uuid.NewString(),
		UserID:    userID,
		TokenHash: HashRefreshToken(refresh),
		ExpiresAt: now.Add(RefreshTokenTTL).UnixMilli(),
		CreatedAt: now.UnixMilli(),
	}); err != nil {
		return TokenPair{}, err
	}
	return TokenPair{Access: access, Refresh: refresh}, nil
}

func nullMillis(t time.Time) sql.NullInt64 {
	return sql.NullInt64{Int64: t.UnixMilli(), Valid: true}
}

func normalizeEmail(e string) string { return strings.ToLower(strings.TrimSpace(e)) }

func validateCredentials(email, password string) error {
	if email == "" || !strings.Contains(email, "@") {
		return apperr.Validation("a valid email is required")
	}
	if len(password) < 8 {
		return apperr.Validation("password must be at least 8 characters")
	}
	return nil
}
