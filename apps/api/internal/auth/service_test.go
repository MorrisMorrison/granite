package auth

import (
	"context"
	"encoding/json"
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

	// Unknown email also fails as unauthorized (no enumeration).
	_, _, err = s.Login(ctx, "nobody@example.com", "supersecret")
	assertCode(t, err, apperr.CodeUnauthorized)
}

func TestFirstUserBootstrapsThenGated(t *testing.T) {
	s := newTestService(t, false) // registration disabled
	ctx := context.Background()

	// The first account is always allowed, to bootstrap a fresh instance.
	if _, _, err := s.Register(ctx, "first@example.com", "supersecret", ""); err != nil {
		t.Fatalf("first user should bootstrap even when registration is disabled: %v", err)
	}
	// Subsequent registrations are gated.
	_, _, err := s.Register(ctx, "second@example.com", "supersecret", "")
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

func TestRegisterValidation(t *testing.T) {
	s := newTestService(t, true)
	ctx := context.Background()

	_, _, err := s.Register(ctx, "a@b.com", "short", "")
	assertCode(t, err, apperr.CodeValidation)

	_, _, err = s.Register(ctx, "not-an-email", "supersecret", "")
	assertCode(t, err, apperr.CodeValidation)

	_, _, err = s.Register(ctx, "long@b.com", string(make([]byte, 200)), "")
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

	// Reusing the old (now-revoked) refresh token must fail as unauthorized...
	_, err = s.Refresh(ctx, pair.Refresh)
	assertCode(t, err, apperr.CodeUnauthorized)

	// ...and it should have revoked the whole family, so the rotated one fails too.
	_, err = s.Refresh(ctx, newPair.Refresh)
	assertCode(t, err, apperr.CodeUnauthorized)
}

func TestRefreshEmptyAndExpired(t *testing.T) {
	s := newTestService(t, true)
	ctx := context.Background()

	_, err := s.Refresh(ctx, "")
	assertCode(t, err, apperr.CodeUnauthorized)

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

func TestUpdateProfileInvalidSettings(t *testing.T) {
	s := newTestService(t, true)
	ctx := context.Background()
	u, _, err := s.Register(ctx, "up@example.com", "supersecret", "")
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	_, err = s.UpdateProfile(ctx, u.ID, nil, json.RawMessage("{not valid"))
	assertCode(t, err, apperr.CodeValidation)
}

func TestUpdateProfileAndGetUser(t *testing.T) {
	s := newTestService(t, true)
	ctx := context.Background()
	u, _, err := s.Register(ctx, "prof@example.com", "supersecret", "Old")
	if err != nil {
		t.Fatalf("register: %v", err)
	}

	name := "New Name"
	updated, err := s.UpdateProfile(ctx, u.ID, &name, json.RawMessage(`{"weightUnit":"lb"}`))
	if err != nil {
		t.Fatalf("update profile: %v", err)
	}
	if updated.DisplayName != "New Name" {
		t.Errorf("DisplayName = %q, want New Name", updated.DisplayName)
	}

	got, err := s.GetUser(ctx, u.ID)
	if err != nil {
		t.Fatalf("get user: %v", err)
	}
	if got.Email != "prof@example.com" || got.DisplayName != "New Name" {
		t.Errorf("got = %+v", got)
	}

	if _, err := s.GetUser(ctx, "nope"); err == nil {
		t.Error("GetUser(unknown) should be NotFound")
	}
	if _, err := s.UpdateProfile(ctx, "nope", &name, nil); err == nil {
		t.Error("UpdateProfile(unknown) should be NotFound")
	}
}

func TestLogoutEmptyRefreshIsNoOp(t *testing.T) {
	s := newTestService(t, true)
	if err := s.Logout(context.Background(), ""); err != nil {
		t.Fatalf("empty logout should be a no-op, got %v", err)
	}
}
