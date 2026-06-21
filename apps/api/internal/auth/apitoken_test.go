package auth

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/MorrisMorrison/granite/apps/api/internal/apperr"
)

func TestAPITokenLifecycle(t *testing.T) {
	s := newTestService(t, true)
	ctx := context.Background()
	user, _, err := s.Register(ctx, "owner@example.com", "supersecret", "Owner")
	if err != nil {
		t.Fatalf("register: %v", err)
	}

	tok, err := s.CreateAPIToken(ctx, user.ID, "CLI", nil, nil)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if !strings.HasPrefix(tok.Token, APITokenPrefix) {
		t.Fatalf("raw token %q missing prefix %q", tok.Token, APITokenPrefix)
	}
	if len(tok.Prefix) != 12 {
		t.Fatalf("display prefix = %q, want 12 chars", tok.Prefix)
	}

	// Authenticates back to the owner.
	uid, _, err := s.AuthenticateAPIToken(ctx, tok.Token)
	if err != nil || uid != user.ID {
		t.Fatalf("authenticate = %q, %v; want %q", uid, err, user.ID)
	}

	// Unknown token is rejected.
	if _, _, err := s.AuthenticateAPIToken(ctx, "gra_nope"); err == nil {
		t.Fatal("expected unknown token to be rejected")
	}

	// List returns metadata only (never the raw secret).
	list, err := s.ListAPITokens(ctx, user.ID)
	if err != nil || len(list) != 1 {
		t.Fatalf("list = %d, %v; want 1", len(list), err)
	}
	if list[0].Token != "" {
		t.Fatal("list must not expose the raw token")
	}

	// Revoke, then it no longer authenticates; revoking again is not-found.
	if err := s.RevokeAPIToken(ctx, user.ID, tok.ID); err != nil {
		t.Fatalf("revoke: %v", err)
	}
	if _, _, err := s.AuthenticateAPIToken(ctx, tok.Token); err == nil {
		t.Fatal("revoked token should not authenticate")
	}
	assertCode(t, s.RevokeAPIToken(ctx, user.ID, tok.ID), apperr.CodeNotFound)
}

func TestAPITokenScopes(t *testing.T) {
	s := newTestService(t, true)
	ctx := context.Background()
	user, _, _ := s.Register(ctx, "scopes@example.com", "supersecret", "Scopes")

	// Default is read-only.
	ro, err := s.CreateAPIToken(ctx, user.ID, "reader", nil, nil)
	if err != nil {
		t.Fatalf("create read-only: %v", err)
	}
	if len(ro.Scopes) != 1 || ro.Scopes[0] != ScopeRead {
		t.Fatalf("default scopes = %v, want [read]", ro.Scopes)
	}
	if _, scopes, _ := s.AuthenticateAPIToken(ctx, ro.Token); ScopesAllowWrite(scopes) {
		t.Fatal("read-only token should not allow writes")
	}

	// Requesting write yields read+write.
	rw, err := s.CreateAPIToken(ctx, user.ID, "writer", []string{ScopeWrite}, nil)
	if err != nil {
		t.Fatalf("create read-write: %v", err)
	}
	if len(rw.Scopes) != 2 {
		t.Fatalf("write token scopes = %v, want [read write]", rw.Scopes)
	}
	if _, scopes, _ := s.AuthenticateAPIToken(ctx, rw.Token); !ScopesAllowWrite(scopes) {
		t.Fatal("write token should allow writes")
	}

	// Scope strings are canonicalized (case-insensitive, trimmed, deduped).
	mixed, err := s.CreateAPIToken(ctx, user.ID, "mixed", []string{"READ", " write "}, nil)
	if err != nil || len(mixed.Scopes) != 2 {
		t.Fatalf("canonicalized scopes = %v (err %v), want [read write]", mixed.Scopes, err)
	}

	// Unknown scope is rejected.
	assertCode(t, mustErr(s.CreateAPIToken(ctx, user.ID, "bad", []string{"admin"}, nil)), apperr.CodeValidation)
}

func TestAPITokenExpiry(t *testing.T) {
	s := newTestService(t, true)
	ctx := context.Background()
	user, _, err := s.Register(ctx, "exp@example.com", "supersecret", "Exp")
	if err != nil {
		t.Fatalf("register: %v", err)
	}

	t0 := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	s.now = func() time.Time { return t0 }
	expires := t0.Add(time.Hour).UnixMilli()
	tok, err := s.CreateAPIToken(ctx, user.ID, "temp", nil, &expires)
	if err != nil {
		t.Fatalf("create with expiry: %v", err)
	}
	if _, _, err := s.AuthenticateAPIToken(ctx, tok.Token); err != nil {
		t.Fatalf("token should be valid before expiry: %v", err)
	}

	// Past expiry: rejected.
	s.now = func() time.Time { return t0.Add(2 * time.Hour) }
	if _, _, err := s.AuthenticateAPIToken(ctx, tok.Token); err == nil {
		t.Fatal("expired token should be rejected")
	}

	// Creating a token that's already expired is a validation error.
	past := t0.Add(-time.Hour).UnixMilli()
	assertCode(t, mustErr(s.CreateAPIToken(ctx, user.ID, "stale", nil, &past)), apperr.CodeValidation)
	assertCode(t, mustErr(s.CreateAPIToken(ctx, user.ID, "", nil, nil)), apperr.CodeValidation)
}

func TestAPITokenLastUsed(t *testing.T) {
	s := newTestService(t, true)
	ctx := context.Background()
	user, _, _ := s.Register(ctx, "lastused@example.com", "supersecret", "LU")

	t0 := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	s.now = func() time.Time { return t0 }
	tok, err := s.CreateAPIToken(ctx, user.ID, "t", nil, nil)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	lastUsed := func() *int64 {
		list, _ := s.ListAPITokens(ctx, user.ID)
		return list[0].LastUsedAt
	}

	if lastUsed() != nil {
		t.Fatal("last_used_at should be null before first use")
	}

	// First authentication stamps it.
	if _, _, err := s.AuthenticateAPIToken(ctx, tok.Token); err != nil {
		t.Fatalf("authenticate: %v", err)
	}
	if lu := lastUsed(); lu == nil || *lu != t0.UnixMilli() {
		t.Fatalf("last_used_at = %v, want %d", lu, t0.UnixMilli())
	}

	// A second use within the throttle window does not rewrite it.
	s.now = func() time.Time { return t0.Add(30 * time.Second) }
	_, _, _ = s.AuthenticateAPIToken(ctx, tok.Token)
	if lu := lastUsed(); *lu != t0.UnixMilli() {
		t.Fatalf("last_used_at = %d, want unchanged %d (throttled)", *lu, t0.UnixMilli())
	}

	// Past the window, it updates.
	later := t0.Add(2 * time.Minute)
	s.now = func() time.Time { return later }
	_, _, _ = s.AuthenticateAPIToken(ctx, tok.Token)
	if lu := lastUsed(); *lu != later.UnixMilli() {
		t.Fatalf("last_used_at = %d, want %d (past throttle window)", *lu, later.UnixMilli())
	}
}

func mustErr(_ APIToken, err error) error { return err }
