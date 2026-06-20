package auth

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/MorrisMorrison/granite/apps/api/internal/apperr"
	"github.com/MorrisMorrison/granite/apps/api/internal/db"
	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
)

func newTestService(t *testing.T, allowRegistration bool) *Service {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	if err := db.Migrate(database); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return NewService(sqlc.New(database), NewTokenManager("test-secret"), allowRegistration)
}

func assertCode(t *testing.T, err error, want apperr.Code) {
	t.Helper()
	var ae *apperr.Error
	if !errors.As(err, &ae) {
		t.Fatalf("expected *apperr.Error, got %v", err)
	}
	if ae.Code != want {
		t.Fatalf("error code = %q, want %q", ae.Code, want)
	}
}

func TestRegisterThenLogin(t *testing.T) {
	s := newTestService(t, true)
	ctx := context.Background()

	user, pair, err := s.Register(ctx, "Test@Example.com", "supersecret", "Tester")
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	if user.Email != "test@example.com" {
		t.Errorf("email = %q, want normalized lower-case", user.Email)
	}
	if pair.Access == "" || pair.Refresh == "" {
		t.Fatal("expected non-empty token pair")
	}

	if _, _, err := s.Login(ctx, "test@example.com", "supersecret"); err != nil {
		t.Fatalf("login with correct creds: %v", err)
	}
	_, _, err = s.Login(ctx, "test@example.com", "wrongpass")
	assertCode(t, err, apperr.CodeUnauthorized)
}

func TestRegisterGatedWhenDisabled(t *testing.T) {
	s := newTestService(t, false)
	_, _, err := s.Register(context.Background(), "a@b.com", "supersecret", "")
	assertCode(t, err, apperr.CodeForbidden)
}

func TestRegisterDuplicateEmail(t *testing.T) {
	s := newTestService(t, true)
	ctx := context.Background()
	if _, _, err := s.Register(ctx, "dupe@example.com", "supersecret", ""); err != nil {
		t.Fatalf("first register: %v", err)
	}
	_, _, err := s.Register(ctx, "dupe@example.com", "supersecret", "")
	assertCode(t, err, apperr.CodeConflict)
}

func TestRegisterShortPassword(t *testing.T) {
	s := newTestService(t, true)
	_, _, err := s.Register(context.Background(), "a@b.com", "short", "")
	assertCode(t, err, apperr.CodeValidation)
}

func TestRefreshRotationAndReuseDetection(t *testing.T) {
	s := newTestService(t, true)
	ctx := context.Background()
	_, pair, err := s.Register(ctx, "rot@example.com", "supersecret", "")
	if err != nil {
		t.Fatalf("register: %v", err)
	}

	newPair, err := s.Refresh(ctx, pair.Refresh)
	if err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if newPair.Refresh == pair.Refresh {
		t.Fatal("refresh token should rotate")
	}

	// Reusing the old (now-revoked) refresh token must fail...
	_, err = s.Refresh(ctx, pair.Refresh)
	assertCode(t, err, apperr.CodeUnauthorized)

	// ...and it should have revoked the whole family, so the new one fails too.
	if _, err := s.Refresh(ctx, newPair.Refresh); err == nil {
		t.Fatal("expected reuse to revoke the rotated token as well")
	}
}

func TestRefreshExpired(t *testing.T) {
	s := newTestService(t, true)
	ctx := context.Background()
	// Issue tokens "in the past" so the refresh token is already expired.
	s.now = func() time.Time { return time.Now().Add(-2 * RefreshTokenTTL) }
	_, pair, err := s.Register(ctx, "exp@example.com", "supersecret", "")
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	s.now = time.Now
	_, err = s.Refresh(ctx, pair.Refresh)
	assertCode(t, err, apperr.CodeUnauthorized)
}

func TestLogoutRevokesRefresh(t *testing.T) {
	s := newTestService(t, true)
	ctx := context.Background()
	_, pair, err := s.Register(ctx, "out@example.com", "supersecret", "")
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	if err := s.Logout(ctx, pair.Refresh); err != nil {
		t.Fatalf("logout: %v", err)
	}
	if _, err := s.Refresh(ctx, pair.Refresh); err == nil {
		t.Fatal("refresh after logout should fail")
	}
	// Logout is idempotent.
	if err := s.Logout(ctx, pair.Refresh); err != nil {
		t.Fatalf("second logout should be a no-op: %v", err)
	}
}
