package server

import (
	"context"
	"net/http"
	"testing"
)

// denyGate refuses every action (tests the register gate wiring).
type denyGate struct{}

func (denyGate) CanRegister(context.Context, string) (bool, error) { return false, nil }
func (denyGate) CanWrite(context.Context, string) (bool, error)    { return false, nil }

// writeDenyGate allows registration but refuses all writes.
type writeDenyGate struct{}

func (writeDenyGate) CanRegister(context.Context, string) (bool, error) { return true, nil }
func (writeDenyGate) CanWrite(context.Context, string) (bool, error)    { return false, nil }

func TestRegisterDeniedByGate(t *testing.T) {
	h, _ := newTestServerWithGate(t, denyGate{})
	rr := doReq(t, h, http.MethodPost, "/api/v1/auth/register", "", map[string]any{
		"email": "x@y.com", "password": "password123",
	})
	if rr.Code != http.StatusForbidden {
		t.Fatalf("register status = %d, want 403", rr.Code)
	}
}

func TestWritesDeniedByGate(t *testing.T) {
	h, _ := newTestServerWithGate(t, writeDenyGate{})
	token := registerUser(t, h, "writes@gate.com") // registration is allowed

	// Reads stay open.
	if pull := doReq(t, h, http.MethodPost, "/api/v1/sync/pull", token, map[string]any{"since": 0}); pull.Code != http.StatusOK {
		t.Fatalf("pull status = %d, want 200 (reads stay open)", pull.Code)
	}

	// Writes are gated centrally — sync push, bulk import, and plain CRUD all 403.
	if push := doReq(t, h, http.MethodPost, "/api/v1/sync/push", token, map[string]any{"changes": []any{}}); push.Code != http.StatusForbidden {
		t.Fatalf("push status = %d, want 403", push.Code)
	}
	imp := doReq(t, h, http.MethodPost, "/api/v1/import", token, map[string]any{
		"exercises": []any{}, "routine_folders": []any{}, "routines": []any{}, "workouts": []any{}, "bodyweight": []any{},
	})
	if imp.Code != http.StatusForbidden {
		t.Fatalf("import status = %d, want 403", imp.Code)
	}
	create := doReq(t, h, http.MethodPost, "/api/v1/exercises", token, map[string]any{
		"name": "Squat", "exercise_type": "weight_reps", "primary_muscle": "quads",
	})
	if create.Code != http.StatusForbidden {
		t.Fatalf("create exercise status = %d, want 403", create.Code)
	}
}
