package server

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/MorrisMorrison/granite/apps/api/gate"
	"github.com/MorrisMorrison/granite/apps/api/internal/auth"
	"github.com/MorrisMorrison/granite/apps/api/internal/db"
	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
	"github.com/MorrisMorrison/granite/apps/api/internal/exercise"
	"github.com/MorrisMorrison/granite/apps/api/internal/routine"
	syncpkg "github.com/MorrisMorrison/granite/apps/api/internal/sync"
	"github.com/MorrisMorrison/granite/apps/api/internal/workout"
)

// covNewTrustedProxyServer builds a server with WithTrustedProxy(true) so the
// middleware.RealIP branch in setupRouter executes. Mirrors newTestServer but
// adds the option (kept separate to avoid touching the shared harness).
func covNewTrustedProxyServer(t *testing.T) http.Handler {
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
	routineSvc := routine.NewService(database, q)
	workoutSvc := workout.NewService(database, q)
	syncSvc := syncpkg.NewService(database, q)
	return New(authSvc, exerciseSvc, routineSvc, workoutSvc, syncSvc, tokens, database,
		[]string{"*"}, WithGate(gate.AllowAll{}), WithTrustedProxy(true)).Handler()
}

// --- 1. Folder list + update ------------------------------------------------

// Create a folder, list it, update it, and confirm the change persists on re-GET.
func TestFolderListAndUpdate(t *testing.T) {
	h, _ := newTestServer(t)
	token := registerUser(t, h, "folders@cov.com")

	// Create.
	rec := doReq(t, h, http.MethodPost, "/api/v1/routine-folders", token, map[string]any{
		"name": "Strength", "order_index": 0,
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create folder = %d: %s", rec.Code, rec.Body)
	}
	var created routine.Folder
	mustJSON(t, rec, &created)
	if created.ID == "" || created.Name != "Strength" {
		t.Fatalf("bad created folder: %+v", created)
	}

	// List → the folder is present.
	rec = doReq(t, h, http.MethodGet, "/api/v1/routine-folders", token, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("list folders = %d: %s", rec.Code, rec.Body)
	}
	var list struct {
		Folders []routine.Folder `json:"folders"`
	}
	mustJSON(t, rec, &list)
	if len(list.Folders) != 1 || list.Folders[0].ID != created.ID {
		t.Fatalf("list folders = %+v, want the created one", list.Folders)
	}

	// Update (PATCH) → new name is returned.
	rec = doReq(t, h, http.MethodPatch, "/api/v1/routine-folders/"+created.ID, token, map[string]any{
		"name": "Hypertrophy", "order_index": 2,
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("update folder = %d: %s", rec.Code, rec.Body)
	}
	var updated routine.Folder
	mustJSON(t, rec, &updated)
	if updated.Name != "Hypertrophy" || updated.OrderIndex != 2 {
		t.Fatalf("update did not apply: %+v", updated)
	}

	// Re-GET (list) → the change persisted.
	rec = doReq(t, h, http.MethodGet, "/api/v1/routine-folders", token, nil)
	mustJSON(t, rec, &list)
	if len(list.Folders) != 1 || list.Folders[0].Name != "Hypertrophy" || list.Folders[0].OrderIndex != 2 {
		t.Fatalf("persisted folder = %+v, want renamed Hypertrophy/order 2", list.Folders)
	}
}

// --- 2. WithTrustedProxy branch ---------------------------------------------

// A server built with WithTrustedProxy(true) still builds and serves; this
// executes the `if trustedProxy { RealIP }` path in setupRouter.
func TestTrustedProxyServerServes(t *testing.T) {
	h := covNewTrustedProxyServer(t)

	rec := doReq(t, h, http.MethodGet, "/healthz", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("healthz on trusted-proxy server = %d: %s", rec.Code, rec.Body)
	}

	// A forwarded header is honored (RealIP consumes it) without breaking the request.
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.7")
	fw := httptest.NewRecorder()
	h.ServeHTTP(fw, req)
	if fw.Code != http.StatusOK {
		t.Fatalf("healthz with X-Forwarded-For = %d", fw.Code)
	}
}

// --- 3. readyz ---------------------------------------------------------------

// GET /readyz with a healthy DB returns 200 and {"status":"ready"}.
func TestReadyzHealthy(t *testing.T) {
	h, _ := newTestServer(t)
	rec := doReq(t, h, http.MethodGet, "/readyz", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("readyz = %d: %s", rec.Code, rec.Body)
	}
	var out struct {
		Status string `json:"status"`
	}
	mustJSON(t, rec, &out)
	if out.Status != "ready" {
		t.Fatalf("readyz status = %q, want ready", out.Status)
	}
}

// --- 4. logout ---------------------------------------------------------------

// Logout revokes the refresh token: a subsequent refresh fails.
func TestLogoutRevokesRefresh(t *testing.T) {
	h, _ := newTestServer(t)
	rec := doReq(t, h, http.MethodPost, "/api/v1/auth/register", "", map[string]any{
		"email": "logout@cov.com", "password": "supersecret",
	})
	var reg authResp
	mustJSON(t, rec, &reg)

	if rec := doReq(t, h, http.MethodPost, "/api/v1/auth/logout", "", map[string]any{"refresh": reg.Refresh}); rec.Code != http.StatusNoContent {
		t.Fatalf("logout = %d: %s", rec.Code, rec.Body)
	}
	if rec := doReq(t, h, http.MethodPost, "/api/v1/auth/refresh", "", map[string]any{"refresh": reg.Refresh}); rec.Code != http.StatusUnauthorized {
		t.Fatalf("refresh after logout = %d, want 401", rec.Code)
	}

	// Logout with an empty refresh is a clean no-op (204), not an error.
	if rec := doReq(t, h, http.MethodPost, "/api/v1/auth/logout", "", map[string]any{"refresh": ""}); rec.Code != http.StatusNoContent {
		t.Fatalf("logout with empty refresh = %d, want 204", rec.Code)
	}
}

// --- 5. toHumaErr taxonomy -> status ----------------------------------------

// A not-found taxonomy error maps to 404; a validation error maps to 400.
func TestErrorMappingNotFoundAndValidation(t *testing.T) {
	h, _ := newTestServer(t)
	token := registerUser(t, h, "errmap@cov.com")

	// NotFound → 404 (GET a routine that does not exist).
	if rec := doReq(t, h, http.MethodGet, "/api/v1/routines/does-not-exist", token, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("get missing routine = %d, want 404: %s", rec.Code, rec.Body)
	}

	// Validation → 400 (create a folder with an empty name; passes huma schema
	// validation but the service rejects it, so toHumaErr maps the taxonomy).
	if rec := doReq(t, h, http.MethodPost, "/api/v1/routine-folders", token, map[string]any{"name": ""}); rec.Code != http.StatusBadRequest {
		t.Fatalf("create folder empty name = %d, want 400: %s", rec.Code, rec.Body)
	}
}
