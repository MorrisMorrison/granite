package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/MorrisMorrison/granite/apps/api/internal/auth"
	"github.com/MorrisMorrison/granite/apps/api/internal/db"
	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
	"github.com/MorrisMorrison/granite/apps/api/internal/exercise"
)

// Response shapes (huma serializes an operation's Body field as the HTTP body).
type authResp struct {
	User    userResponse `json:"user"`
	Access  string       `json:"access"`
	Refresh string       `json:"refresh"`
}
type tokenResp struct {
	Access  string `json:"access"`
	Refresh string `json:"refresh"`
}
type listResp struct {
	Exercises []exerciseResponse `json:"exercises"`
}

func newTestServer(t *testing.T) (http.Handler, *sqlc.Queries) {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	if err := db.Migrate(database); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	q := sqlc.New(database)
	tokens := auth.NewTokenManager("test-secret")
	authSvc := auth.NewService(q, tokens, true)
	exerciseSvc := exercise.NewService(q)
	return New(authSvc, exerciseSvc, tokens, database, []string{"*"}).Handler(), q
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

func registerUser(t *testing.T, h http.Handler, email string) string {
	t.Helper()
	rec := doReq(t, h, http.MethodPost, "/api/v1/auth/register", "", map[string]any{
		"email": email, "password": "supersecret",
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("register %s = %d: %s", email, rec.Code, rec.Body)
	}
	var out authResp
	mustJSON(t, rec, &out)
	return out.Access
}

func TestHealthAndReady(t *testing.T) {
	h, _ := newTestServer(t)
	if rec := doReq(t, h, http.MethodGet, "/healthz", "", nil); rec.Code != http.StatusOK {
		t.Fatalf("healthz = %d", rec.Code)
	}
	if rec := doReq(t, h, http.MethodGet, "/readyz", "", nil); rec.Code != http.StatusOK {
		t.Fatalf("readyz = %d", rec.Code)
	}
}

func TestRegisterLoginMeFlow(t *testing.T) {
	h, _ := newTestServer(t)
	access := registerUser(t, h, "a@b.com")

	if rec := doReq(t, h, http.MethodGet, "/api/v1/me", "", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("me without token = %d, want 401", rec.Code)
	}

	rec := doReq(t, h, http.MethodGet, "/api/v1/me", access, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("me = %d: %s", rec.Code, rec.Body)
	}
	var me userResponse
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
	h, _ := newTestServer(t)
	// huma schema validation (minLength) → 422.
	if rec := doReq(t, h, http.MethodPost, "/api/v1/auth/register", "", map[string]any{
		"email": "a@b.com", "password": "short",
	}); rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("short password = %d, want 422", rec.Code)
	}

	body := map[string]any{"email": "dupe@b.com", "password": "supersecret"}
	doReq(t, h, http.MethodPost, "/api/v1/auth/register", "", body)
	if rec := doReq(t, h, http.MethodPost, "/api/v1/auth/register", "", body); rec.Code != http.StatusConflict {
		t.Fatalf("duplicate register = %d, want 409", rec.Code)
	}
}

func TestRefreshAndLogoutFlow(t *testing.T) {
	h, _ := newTestServer(t)
	rec := doReq(t, h, http.MethodPost, "/api/v1/auth/register", "", map[string]any{
		"email": "r@b.com", "password": "supersecret",
	})
	var reg authResp
	mustJSON(t, rec, &reg)

	rec = doReq(t, h, http.MethodPost, "/api/v1/auth/refresh", "", map[string]any{"refresh": reg.Refresh})
	if rec.Code != http.StatusOK {
		t.Fatalf("refresh = %d: %s", rec.Code, rec.Body)
	}
	var refreshed tokenResp
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

func TestExerciseCRUD(t *testing.T) {
	h, _ := newTestServer(t)
	access := registerUser(t, h, "ex@b.com")

	rec := doReq(t, h, http.MethodPost, "/api/v1/exercises", access, map[string]any{
		"name": "My Press", "exercise_type": "weight_reps", "primary_muscle": "Chest",
		"secondary_muscles": []string{"Triceps"},
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create = %d: %s", rec.Code, rec.Body)
	}
	var created exerciseResponse
	mustJSON(t, rec, &created)
	if created.ID == "" || created.IsBuiltin || len(created.SecondaryMuscles) != 1 {
		t.Fatalf("bad created exercise: %+v", created)
	}

	rec = doReq(t, h, http.MethodGet, "/api/v1/exercises", access, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("list = %d", rec.Code)
	}
	var list listResp
	mustJSON(t, rec, &list)
	if len(list.Exercises) != 1 {
		t.Fatalf("list len = %d, want 1", len(list.Exercises))
	}

	if rec := doReq(t, h, http.MethodGet, "/api/v1/exercises/"+created.ID, access, nil); rec.Code != http.StatusOK {
		t.Fatalf("get = %d", rec.Code)
	}
	if rec := doReq(t, h, http.MethodDelete, "/api/v1/exercises/"+created.ID, access, nil); rec.Code != http.StatusNoContent {
		t.Fatalf("delete = %d, want 204", rec.Code)
	}
	if rec := doReq(t, h, http.MethodGet, "/api/v1/exercises/"+created.ID, access, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("get after delete = %d, want 404", rec.Code)
	}
}

func TestBuiltinExercisesReadOnly(t *testing.T) {
	h, q := newTestServer(t)
	if _, err := exercise.SeedBuiltins(context.Background(), q, func() time.Time { return time.Unix(0, 0) }); err != nil {
		t.Fatalf("seed: %v", err)
	}
	access := registerUser(t, h, "bi@b.com")

	rec := doReq(t, h, http.MethodGet, "/api/v1/exercises", access, nil)
	var list listResp
	mustJSON(t, rec, &list)
	var builtinID string
	for _, e := range list.Exercises {
		if e.IsBuiltin {
			builtinID = e.ID
			break
		}
	}
	if builtinID == "" {
		t.Fatal("expected a built-in exercise in the list")
	}

	if rec := doReq(t, h, http.MethodPatch, "/api/v1/exercises/"+builtinID, access, map[string]any{
		"name": "hacked", "exercise_type": "weight_reps",
	}); rec.Code != http.StatusForbidden {
		t.Fatalf("update built-in = %d, want 403", rec.Code)
	}
	if rec := doReq(t, h, http.MethodDelete, "/api/v1/exercises/"+builtinID, access, nil); rec.Code != http.StatusForbidden {
		t.Fatalf("delete built-in = %d, want 403", rec.Code)
	}
}
