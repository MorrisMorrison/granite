package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Token lifetimes.
const (
	AccessTokenTTL  = 15 * time.Minute
	RefreshTokenTTL = 30 * 24 * time.Hour
)

// TokenManager issues and validates JWT access tokens (HS256).
type TokenManager struct {
	secret []byte
}

// NewTokenManager returns a TokenManager signing with the given secret.
func NewTokenManager(secret string) *TokenManager {
	return &TokenManager{secret: []byte(secret)}
}

// GenerateAccessToken issues a short-lived access token for userID.
func (m *TokenManager) GenerateAccessToken(userID string, now time.Time) (string, error) {
	claims := jwt.RegisteredClaims{
		Subject:   userID,
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(AccessTokenTTL)),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
}

// ParseAccessToken validates a token and returns its subject (user id).
func (m *TokenManager) ParseAccessToken(tokenStr string) (string, error) {
	claims := &jwt.RegisteredClaims{}
	tok, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return m.secret, nil
	})
	if err != nil {
		return "", err
	}
	if !tok.Valid {
		return "", errors.New("invalid token")
	}
	return claims.Subject, nil
}

// GenerateRefreshToken returns a new random opaque refresh token (URL-safe).
func GenerateRefreshToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// HashRefreshToken returns the sha-256 hex digest stored server-side (the raw
// token is never persisted).
func HashRefreshToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// APITokenPrefix identifies personal API tokens (vs JWT access tokens) on the wire.
const APITokenPrefix = "gra_"

// GenerateAPIToken returns a new opaque personal API token, prefixed for easy
// identification (e.g. in the Authorization header and secret scanners).
func GenerateAPIToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return APITokenPrefix + base64.RawURLEncoding.EncodeToString(b), nil
}

// HashToken returns the sha-256 hex digest stored server-side for opaque tokens.
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
