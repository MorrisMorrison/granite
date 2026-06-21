package auth

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/google/uuid"

	"github.com/MorrisMorrison/granite/apps/api/internal/apperr"
	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
)

// APIToken is the client-facing representation of a personal API token. The raw
// Token is only ever populated when a token is first created.
type APIToken struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Prefix     string `json:"prefix"`
	Token      string `json:"token,omitempty"`
	LastUsedAt *int64 `json:"last_used_at"`
	ExpiresAt  *int64 `json:"expires_at"`
	CreatedAt  int64  `json:"created_at"`
}

func toAPIToken(t sqlc.ApiToken) APIToken {
	return APIToken{
		ID:         t.ID,
		Name:       t.Name,
		Prefix:     t.Prefix,
		LastUsedAt: ptrInt64(t.LastUsedAt),
		ExpiresAt:  ptrInt64(t.ExpiresAt),
		CreatedAt:  t.CreatedAt,
	}
}

// CreateAPIToken issues a new personal API token for the user. The returned
// APIToken carries the raw Token, which is shown to the caller exactly once.
func (s *Service) CreateAPIToken(ctx context.Context, userID, name string, expiresAt *int64) (APIToken, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return APIToken{}, apperr.Validation("a token name is required")
	}
	if len(name) > 100 {
		return APIToken{}, apperr.Validation("token name must be at most 100 characters")
	}
	now := s.now().UnixMilli()
	if expiresAt != nil && *expiresAt <= now {
		return APIToken{}, apperr.Validation("expiry must be in the future")
	}

	raw, err := GenerateAPIToken()
	if err != nil {
		return APIToken{}, err
	}
	row, err := s.q.CreateApiToken(ctx, sqlc.CreateApiTokenParams{
		ID:        uuid.NewString(),
		UserID:    userID,
		Name:      name,
		TokenHash: HashToken(raw),
		Prefix:    raw[:12], // "gra_" + 8 chars, enough to identify
		ExpiresAt: nullInt64(expiresAt),
		CreatedAt: now,
	})
	if err != nil {
		return APIToken{}, err
	}
	out := toAPIToken(row)
	out.Token = raw
	return out, nil
}

// ListAPITokens returns the user's tokens (metadata only — never the raw token).
func (s *Service) ListAPITokens(ctx context.Context, userID string) ([]APIToken, error) {
	rows, err := s.q.ListApiTokensByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]APIToken, 0, len(rows))
	for _, r := range rows {
		out = append(out, toAPIToken(r))
	}
	return out, nil
}

// RevokeAPIToken deletes one of the user's tokens. Revoking a token that doesn't
// exist (or belongs to someone else) is a not-found.
func (s *Service) RevokeAPIToken(ctx context.Context, userID, id string) error {
	n, err := s.q.DeleteApiToken(ctx, sqlc.DeleteApiTokenParams{ID: id, UserID: userID})
	if err != nil {
		return err
	}
	if n == 0 {
		return apperr.NotFound("token not found")
	}
	return nil
}

// AuthenticateAPIToken resolves a raw API token to its owner, rejecting unknown
// or expired tokens. It best-effort updates last_used_at.
func (s *Service) AuthenticateAPIToken(ctx context.Context, raw string) (string, error) {
	row, err := s.q.GetApiTokenByHash(ctx, HashToken(raw))
	if errors.Is(err, sql.ErrNoRows) {
		return "", apperr.Unauthorized("invalid API token")
	} else if err != nil {
		return "", err
	}
	now := s.now()
	if row.ExpiresAt.Valid && now.UnixMilli() >= row.ExpiresAt.Int64 {
		return "", apperr.Unauthorized("API token has expired")
	}
	_ = s.q.TouchApiToken(ctx, sqlc.TouchApiTokenParams{LastUsedAt: nullMillis(now), ID: row.ID})
	return row.UserID, nil
}

func nullInt64(p *int64) sql.NullInt64 {
	if p == nil {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: *p, Valid: true}
}

func ptrInt64(n sql.NullInt64) *int64 {
	if !n.Valid {
		return nil
	}
	v := n.Int64
	return &v
}
