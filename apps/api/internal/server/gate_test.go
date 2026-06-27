package server

import (
	"context"
	"net/http"
	"testing"
)

// denyGate refuses every action (tests the register gate wiring).
type denyGate struct{}

func (denyGate) CanRegister(context.Context, string) (bool, error) { return false, nil }
func (denyGate) CanSync(context.Context, string) (bool, error)     { return false, nil }

// syncDenyGate allows registration but refuses sync (used by the sync-gate test).
type syncDenyGate struct{}

func (syncDenyGate) CanRegister(context.Context, string) (bool, error) { return true, nil }
func (syncDenyGate) CanSync(context.Context, string) (bool, error)     { return false, nil }

func TestRegisterDeniedByGate(t *testing.T) {
	h, _ := newTestServerWithGate(t, denyGate{})
	rr := doReq(t, h, http.MethodPost, "/api/v1/auth/register", "", map[string]any{
		"email": "x@y.com", "password": "password123",
	})
	if rr.Code != http.StatusForbidden {
		t.Fatalf("register status = %d, want 403", rr.Code)
	}
}

func TestSyncDeniedByGate(t *testing.T) {
	h, _ := newTestServerWithGate(t, syncDenyGate{})
	token := registerUser(t, h, "sync@gate.com") // allowed by syncDenyGate

	pull := doReq(t, h, http.MethodPost, "/api/v1/sync/pull", token, map[string]any{"since": 0})
	if pull.Code != http.StatusForbidden {
		t.Fatalf("pull status = %d, want 403", pull.Code)
	}
	push := doReq(t, h, http.MethodPost, "/api/v1/sync/push", token, map[string]any{"changes": []any{}})
	if push.Code != http.StatusForbidden {
		t.Fatalf("push status = %d, want 403", push.Code)
	}
}
