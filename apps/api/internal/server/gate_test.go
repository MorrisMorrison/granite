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
