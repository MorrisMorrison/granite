package server

import (
	"net/http"
	"strings"
	"testing"
)

// The embedded web app is served at the root, with a client-side routing
// fallback; API paths still get a JSON 404.
func TestWebUIServing(t *testing.T) {
	h, _ := newTestServer(t)

	t.Run("root serves the web app", func(t *testing.T) {
		rec := doReq(t, h, http.MethodGet, "/", "", nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("GET / = %d, want 200", rec.Code)
		}
		if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/html") {
			t.Fatalf("GET / content-type = %q, want text/html", ct)
		}
		if !strings.Contains(rec.Body.String(), "Granite") {
			t.Fatalf("GET / body missing app marker: %s", rec.Body.String())
		}
	})

	t.Run("client route falls back to index.html", func(t *testing.T) {
		rec := doReq(t, h, http.MethodGet, "/routines/some-id", "", nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("GET /routines/some-id = %d, want 200 (SPA fallback)", rec.Code)
		}
		if !strings.Contains(rec.Body.String(), "Granite") {
			t.Fatalf("SPA fallback body missing app marker")
		}
	})

	t.Run("unknown API path is a JSON 404", func(t *testing.T) {
		rec := doReq(t, h, http.MethodGet, "/api/v1/nonexistent", "", nil)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("GET /api/v1/nonexistent = %d, want 404", rec.Code)
		}
		if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
			t.Fatalf("API 404 content-type = %q, want application/json", ct)
		}
	})

	t.Run("health endpoints still work", func(t *testing.T) {
		if rec := doReq(t, h, http.MethodGet, "/healthz", "", nil); rec.Code != http.StatusOK {
			t.Fatalf("healthz = %d", rec.Code)
		}
	})
}
