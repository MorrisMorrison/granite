package server

import (
	"net/http"
	"strings"
	"testing"
)

type apiTokenResp struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Prefix    string   `json:"prefix"`
	Token     string   `json:"token"`
	Scopes    []string `json:"scopes"`
	ExpiresAt *int64   `json:"expires_at"`
	CreatedAt int64    `json:"created_at"`
}

type tokensListResp struct {
	Tokens []apiTokenResp `json:"tokens"`
}

func TestAPITokenFlow(t *testing.T) {
	h, _ := newTestServer(t)
	access := registerUser(t, h, "tok@user.com")

	// Create a token with the interactive (JWT) session.
	rec := doReq(t, h, http.MethodPost, "/api/v1/tokens", access, map[string]any{"name": "CLI"})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create token = %d: %s", rec.Code, rec.Body)
	}
	var created apiTokenResp
	mustJSON(t, rec, &created)
	if !strings.HasPrefix(created.Token, "gra_") || created.Name != "CLI" {
		t.Fatalf("unexpected created token: %+v", created)
	}

	// The raw token authenticates a protected endpoint.
	if rec := doReq(t, h, http.MethodGet, "/api/v1/me", created.Token, nil); rec.Code != http.StatusOK {
		t.Fatalf("GET /me with API token = %d, want 200", rec.Code)
	}

	// List shows metadata only (never the raw secret).
	rec = doReq(t, h, http.MethodGet, "/api/v1/tokens", access, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("list tokens = %d", rec.Code)
	}
	var list tokensListResp
	mustJSON(t, rec, &list)
	if len(list.Tokens) != 1 || list.Tokens[0].Token != "" {
		t.Fatalf("list = %+v, want 1 token with no raw secret", list.Tokens)
	}

	// An API token can't manage tokens. (This token is read-only, so the POST is
	// stopped by write-enforcement; the GET list is a read and is stopped by
	// requireInteractive. See TestAPITokenManagementNeedsSession for that guard in
	// isolation with a write-scoped token.)
	if rec := doReq(t, h, http.MethodPost, "/api/v1/tokens", created.Token, map[string]any{"name": "x"}); rec.Code != http.StatusForbidden {
		t.Fatalf("create token via API token = %d, want 403", rec.Code)
	}
	if rec := doReq(t, h, http.MethodGet, "/api/v1/tokens", created.Token, nil); rec.Code != http.StatusForbidden {
		t.Fatalf("list tokens via API token = %d, want 403", rec.Code)
	}

	// Revoke, then the token stops working.
	if rec := doReq(t, h, http.MethodDelete, "/api/v1/tokens/"+created.ID, access, nil); rec.Code != http.StatusNoContent {
		t.Fatalf("revoke = %d, want 204", rec.Code)
	}
	if rec := doReq(t, h, http.MethodGet, "/api/v1/me", created.Token, nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("revoked token still works: %d, want 401", rec.Code)
	}
}

func TestAPITokenWriteScope(t *testing.T) {
	h, _ := newTestServer(t)
	access := registerUser(t, h, "scope@user.com")

	// Default token is read-only.
	rec := doReq(t, h, http.MethodPost, "/api/v1/tokens", access, map[string]any{"name": "ro"})
	var ro apiTokenResp
	mustJSON(t, rec, &ro)
	if len(ro.Scopes) != 1 || ro.Scopes[0] != "read" {
		t.Fatalf("default scopes = %v, want [read]", ro.Scopes)
	}
	// Reads work; writes are forbidden.
	if rec := doReq(t, h, http.MethodGet, "/api/v1/routines", ro.Token, nil); rec.Code != http.StatusOK {
		t.Fatalf("read with read-only token = %d, want 200", rec.Code)
	}
	if rec := doReq(t, h, http.MethodPost, "/api/v1/routines", ro.Token, map[string]any{"title": "X", "exercises": []any{}}); rec.Code != http.StatusForbidden {
		t.Fatalf("write with read-only token = %d, want 403", rec.Code)
	}

	// An unknown scope is rejected (the only gate — OpenAPI types scopes as a free string[]).
	if rec := doReq(t, h, http.MethodPost, "/api/v1/tokens", access, map[string]any{"name": "bad", "scopes": []string{"admin"}}); rec.Code != http.StatusUnprocessableEntity && rec.Code != http.StatusBadRequest {
		t.Fatalf("unknown scope = %d, want 4xx", rec.Code)
	}

	// A write-scoped token can write.
	rec = doReq(t, h, http.MethodPost, "/api/v1/tokens", access, map[string]any{"name": "rw", "scopes": []string{"write"}})
	var rw apiTokenResp
	mustJSON(t, rec, &rw)
	if rec := doReq(t, h, http.MethodPost, "/api/v1/routines", rw.Token, map[string]any{"title": "X", "exercises": []any{}}); rec.Code != http.StatusCreated {
		t.Fatalf("write with read-write token = %d, want 201: %s", rec.Code, rec.Body)
	}
}

// A write-scoped token passes write-enforcement but still can't manage tokens —
// isolating the requireInteractive (JWT-only) guard.
func TestAPITokenManagementNeedsSession(t *testing.T) {
	h, _ := newTestServer(t)
	access := registerUser(t, h, "mgmt@user.com")
	rec := doReq(t, h, http.MethodPost, "/api/v1/tokens", access, map[string]any{"name": "rw", "scopes": []string{"write"}})
	var rw apiTokenResp
	mustJSON(t, rec, &rw)

	if rec := doReq(t, h, http.MethodPost, "/api/v1/tokens", rw.Token, map[string]any{"name": "x"}); rec.Code != http.StatusForbidden {
		t.Fatalf("write token minting a token = %d, want 403 (requireInteractive)", rec.Code)
	}
	if rec := doReq(t, h, http.MethodGet, "/api/v1/tokens", rw.Token, nil); rec.Code != http.StatusForbidden {
		t.Fatalf("write token listing tokens = %d, want 403", rec.Code)
	}
}

func TestAPITokenCannotBeRevokedByOtherUser(t *testing.T) {
	h, _ := newTestServer(t)
	a := registerUser(t, h, "owner@a.com")
	b := registerUser(t, h, "other@b.com")

	rec := doReq(t, h, http.MethodPost, "/api/v1/tokens", a, map[string]any{"name": "A's"})
	var created apiTokenResp
	mustJSON(t, rec, &created)

	if rec := doReq(t, h, http.MethodDelete, "/api/v1/tokens/"+created.ID, b, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("cross-user revoke = %d, want 404", rec.Code)
	}
}
