package server

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
	"github.com/MorrisMorrison/granite/apps/api/internal/exercise"
)

// seedBuiltinID seeds the built-in library and returns one built-in exercise id,
// discovered via the list endpoint (which flags is_builtin for user_id NULL rows).
func seedBuiltinID(t *testing.T, h http.Handler, q *sqlc.Queries, token string) string {
	t.Helper()
	if _, err := exercise.SeedBuiltins(context.Background(), q, func() time.Time { return time.Unix(0, 0) }); err != nil {
		t.Fatalf("seed: %v", err)
	}
	rec := doReq(t, h, http.MethodGet, "/api/v1/exercises", token, nil)
	var list listResp
	mustJSON(t, rec, &list)
	for _, e := range list.Exercises {
		if e.IsBuiltin {
			return e.ID
		}
	}
	t.Fatal("expected a built-in exercise in the list")
	return ""
}

// Fix 1: a push targeting a seeded built-in exercise (user_id NULL) must be
// rejected — a built-in is instance-wide and read-only (mirrors the CRUD guard /
// ADR-0008). Neither a name change nor a soft-delete may take effect, and a
// second user must still see the unchanged built-in.
func TestSyncPushCannotMutateBuiltin(t *testing.T) {
	h, q := newTestServer(t)
	tokenA := registerUser(t, h, "sync@builtin-a.com")
	tokenB := registerUser(t, h, "sync@builtin-b.com")

	builtinID := seedBuiltinID(t, h, q, tokenA)

	// Capture the original name as seen by user B (built-ins are visible to all).
	orig := builtinNameFor(t, h, tokenB, builtinID)
	if orig == "" {
		t.Fatal("could not read original built-in name")
	}

	// Attempt to rename the built-in via push (updated_at far in the future).
	res := push(t, h, tokenA, change("exercise", builtinID, 9_000_000, false, map[string]any{
		"name": "Hijacked Builtin", "exercise_type": "weight_reps", "primary_muscle": "x",
	}))
	if len(res.Applied) != 0 {
		t.Fatalf("built-in rename applied = %v, want none", res.Applied)
	}

	// Attempt to soft-delete the built-in via push.
	res = push(t, h, tokenA, change("exercise", builtinID, 9_000_001, true, map[string]any{
		"name": orig, "exercise_type": "weight_reps", "primary_muscle": "x",
	}))
	if len(res.Applied) != 0 {
		t.Fatalf("built-in delete applied = %v, want none", res.Applied)
	}

	// User B still sees the original, non-deleted built-in.
	if got := builtinNameFor(t, h, tokenB, builtinID); got != orig {
		t.Fatalf("built-in name for user B = %q, want %q (built-in was mutated)", got, orig)
	}
}

// builtinNameFor returns the built-in exercise's name as seen by the given user,
// or "" if it is not visible (e.g. it got soft-deleted).
func builtinNameFor(t *testing.T, h http.Handler, token, id string) string {
	t.Helper()
	rec := doReq(t, h, http.MethodGet, "/api/v1/exercises", token, nil)
	var list listResp
	mustJSON(t, rec, &list)
	for _, e := range list.Exercises {
		if e.ID == id {
			return e.Name
		}
	}
	return ""
}

// Fix 3: applying the same batch twice yields identical state and no spurious
// re-application — the LWW compare lives in the upsert's ON CONFLICT WHERE, so a
// replay (equal updated_at) is a no-op that leaves exactly one record. This is
// the deterministic idempotency check standing in for the (flaky) concurrent
// same-record convergence test.
func TestSyncApplyBatchTwiceIdempotent(t *testing.T) {
	h, _ := newTestServer(t)
	token := registerUser(t, h, "sync@idem2.com")

	batch := []map[string]any{
		change("exercise", "ex-idem2", 1000, false, map[string]any{"name": "Once", "primary_muscle": "x"}),
	}

	first := push(t, h, token, batch...)
	if len(first.Applied) != 1 {
		t.Fatalf("first apply = %v, want 1", first.Applied)
	}

	// Re-apply the identical batch: no change should ship on the wire twice.
	push(t, h, token, batch...)

	got := pull(t, h, token, 0)
	var count int
	for _, c := range got.Changes {
		if c.ID == "ex-idem2" {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("pull returned %d copies of ex-idem2 after double apply, want 1", count)
	}
	if c := findChange(got.Changes, "ex-idem2"); c == nil || c.Data["name"] != "Once" {
		t.Fatalf("record state drifted after replay: %+v", c)
	}
}
