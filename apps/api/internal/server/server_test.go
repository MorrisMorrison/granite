package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthzReturnsOK(t *testing.T) {
	rec := do(t, http.MethodGet, "/healthz")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("content-type = %q, want application/json", ct)
	}
	if got, want := rec.Body.String(), `{"status":"ok"}`; got != want {
		t.Errorf("body = %q, want %q", got, want)
	}
}

func TestReadyzReturnsOK(t *testing.T) {
	rec := do(t, http.MethodGet, "/readyz")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestRootReturnsHTML(t *testing.T) {
	rec := do(t, http.MethodGet, "/")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "text/html; charset=utf-8" {
		t.Errorf("content-type = %q, want text/html", ct)
	}
}

func TestUnknownPathReturns404(t *testing.T) {
	rec := do(t, http.MethodGet, "/does-not-exist")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func do(t *testing.T, method, target string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, target, nil)
	rec := httptest.NewRecorder()
	New().Handler().ServeHTTP(rec, req)
	return rec
}
