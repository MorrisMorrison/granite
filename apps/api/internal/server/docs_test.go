package server

import (
	"net/http"
	"strings"
	"testing"
)

// The API ships a public, interactive reference (huma's built-in docs) plus the
// machine-readable OpenAPI spec — both reachable without auth and not shadowed by
// the SPA's catch-all. This guards that they stay served.
func TestAPIReferenceAndSpecServed(t *testing.T) {
	h, _ := newTestServer(t)

	rec := doReq(t, h, http.MethodGet, "/docs", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /docs = %d, want 200", rec.Code)
	}
	if body := rec.Body.String(); !strings.Contains(body, "/openapi") {
		t.Fatalf("/docs did not return the API reference (no spec reference found): %.120s", body)
	}

	rec = doReq(t, h, http.MethodGet, "/openapi.yaml", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /openapi.yaml = %d, want 200", rec.Code)
	}
	if body := rec.Body.String(); !strings.Contains(body, "openapi:") {
		t.Fatalf("/openapi.yaml missing 'openapi:' header: %.80s", body)
	}

	rec = doReq(t, h, http.MethodGet, "/openapi.json", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /openapi.json = %d, want 200", rec.Code)
	}
}
