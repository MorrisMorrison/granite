package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/MorrisMorrison/granite/apps/api/internal/auth"
	"github.com/MorrisMorrison/granite/apps/api/internal/db"
	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
)

func newTestServer(t *testing.T) http.Handler {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	if err := db.Migrate(database); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	tokens := auth.NewTokenManager("test-secret")
	svc := auth.NewService(sqlc.New(database), tokens, true)
	return New(svc, tokens, database, []string{"*"}).Handler()
}

func doReq(t *testing.T, h http.Handler, method, path, token string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("encode body: %v", err)
		}
	}
	req := httptest.NewRequest(method, path, &buf)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func mustJSON(t *testing.T, rec *httptest.ResponseRecorder, dst any) {
	t.Helper()
	if err := json.Unmarshal(rec.Body.Bytes(), dst); err != nil {
		t.Fatalf("decode response: %v (body: %s)", err, rec.Body.String())
	}
}

func TestHealthAndReady(t *testing.T) {
	h := newTestServer(t)
	if rec := doReq(t, h, http.MethodGet, "/healthz", "", nil); rec.Code != http.StatusOK {
		t.Fatalf("healthz = %d", rec.Code)
	}
	if rec := doReq(t, h, http.MethodGet, "/readyz", "", nil); rec.Code != http.StatusOK {
		t.Fatalf("readyz = %d", rec.Code)
	}
}

func TestRegisterLoginMeFlow(t *testing.T) {
	h := newTestServer(t)
	rec := doReq(t, h, http.MethodPost, "/api/v1/auth/register", "", map[string]any{
		"email": "a@b.com", "password": "supersecret", "display_name": "A",
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("register = %d: %s", rec.Code, rec.Body)
	}
	var reg authResponse
	mustJSON(t, rec, &reg)
	if reg.Access == "" || reg.Refresh == "" {
		t.Fatal("expected tokens in register response")
	}

	if rec := doReq(t, h, http.MethodGet, "/api/v1/me", "", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("me without token = %d, want 401", rec.Code)
	}

	rec = doReq(t, h, http.MethodGet, "/api/v1/me", reg.Access, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("me = %d: %s", rec.Code, rec.Body)
	}
	var me auth.User
	mustJSON(t, rec, &me)
	if me.Email != "a@b.com" {
		t.Fatalf("me.email = %q", me.Email)
	}

	if rec := doReq(t, h, http.MethodPost, "/api/v1/auth/login", "", map[string]any{
		"email": "a@b.com", "password": "supersecret",
	}); rec.Code != http.StatusOK {
		t.Fatalf("login = %d", rec.Code)
	}
}

func TestRegisterValidationAndConflict(t *testing.T) {
	h := newTestServer(t)
	if rec := doReq(t, h, http.MethodPost, "/api/v1/auth/register", "", map[string]any{
		"email": "a@b.com", "password": "short",
	}); rec.Code != http.StatusBadRequest {
		t.Fatalf("short password = %d, want 400", rec.Code)
	}

	body := map[string]any{"email": "dupe@b.com", "password": "supersecret"}
	doReq(t, h, http.MethodPost, "/api/v1/auth/register", "", body)
	if rec := doReq(t, h, http.MethodPost, "/api/v1/auth/register", "", body); rec.Code != http.StatusConflict {
		t.Fatalf("duplicate register = %d, want 409", rec.Code)
	}
}

func TestRefreshAndLogoutFlow(t *testing.T) {
	h := newTestServer(t)
	rec := doReq(t, h, http.MethodPost, "/api/v1/auth/register", "", map[string]any{
		"email": "r@b.com", "password": "supersecret",
	})
	var reg authResponse
	mustJSON(t, rec, &reg)

	rec = doReq(t, h, http.MethodPost, "/api/v1/auth/refresh", "", map[string]any{"refresh": reg.Refresh})
	if rec.Code != http.StatusOK {
		t.Fatalf("refresh = %d: %s", rec.Code, rec.Body)
	}
	var refreshed tokenResponse
	mustJSON(t, rec, &refreshed)
	if refreshed.Refresh == reg.Refresh {
		t.Fatal("refresh token should rotate")
	}

	if rec := doReq(t, h, http.MethodPost, "/api/v1/auth/logout", "", map[string]any{"refresh": refreshed.Refresh}); rec.Code != http.StatusNoContent {
		t.Fatalf("logout = %d", rec.Code)
	}
	if rec := doReq(t, h, http.MethodPost, "/api/v1/auth/refresh", "", map[string]any{"refresh": refreshed.Refresh}); rec.Code != http.StatusUnauthorized {
		t.Fatalf("refresh after logout = %d, want 401", rec.Code)
	}
}

func TestUpdateMe(t *testing.T) {
	h := newTestServer(t)
	rec := doReq(t, h, http.MethodPost, "/api/v1/auth/register", "", map[string]any{
		"email": "m@b.com", "password": "supersecret",
	})
	var reg authResponse
	mustJSON(t, rec, &reg)

	rec = doReq(t, h, http.MethodPatch, "/api/v1/me", reg.Access, map[string]any{
		"display_name": "New Name",
		"settings":     map[string]any{"units": "kg"},
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("patch me = %d: %s", rec.Code, rec.Body)
	}
	var me auth.User
	mustJSON(t, rec, &me)
	if me.DisplayName != "New Name" {
		t.Fatalf("display_name = %q", me.DisplayName)
	}
}
