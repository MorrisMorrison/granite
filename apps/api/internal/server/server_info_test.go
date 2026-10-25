package server

import (
	"net/http"
	"testing"
)

func TestServerInfoReturnsInstanceID(t *testing.T) {
	h, _ := newTestServer(t)
	token := registerUser(t, h, "info@example.com")

	rec := doReq(t, h, http.MethodGet, "/api/v1/server-info", token, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("server-info = %d: %s", rec.Code, rec.Body)
	}
	var out struct {
		InstanceID string `json:"instance_id"`
	}
	mustJSON(t, rec, &out)
	if out.InstanceID == "" {
		t.Fatal("expected a non-empty instance_id")
	}

	// Stable within the same database (a fresh DB would get a different one).
	rec2 := doReq(t, h, http.MethodGet, "/api/v1/server-info", token, nil)
	var out2 struct {
		InstanceID string `json:"instance_id"`
	}
	mustJSON(t, rec2, &out2)
	if out2.InstanceID != out.InstanceID {
		t.Fatalf("instance_id changed within a DB: %q vs %q", out.InstanceID, out2.InstanceID)
	}
}

func TestServerInfoRequiresAuth(t *testing.T) {
	h, _ := newTestServer(t)
	rec := doReq(t, h, http.MethodGet, "/api/v1/server-info", "", nil)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("server-info without a token = %d, want 401: %s", rec.Code, rec.Body)
	}
}

func TestInfoIsPublicAndIdentifiesGranite(t *testing.T) {
	h, _ := newTestServer(t)
	rec := doReq(t, h, http.MethodGet, "/api/v1/info", "", nil) // no token
	if rec.Code != http.StatusOK {
		t.Fatalf("info = %d: %s", rec.Code, rec.Body)
	}
	var out struct {
		Name       string `json:"name"`
		APIVersion int    `json:"api_version"`
	}
	mustJSON(t, rec, &out)
	if out.Name != "granite" || out.APIVersion != 1 {
		t.Fatalf("info = %+v, want name=granite api_version=1", out)
	}
}
