package server

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/MorrisMorrison/granite/apps/api/internal/exercise"
	"github.com/MorrisMorrison/granite/apps/api/internal/routine"
)

// TestExportRestoreReferencesBuiltin is the disaster-recovery path: a routine that
// references a BUILT-IN exercise must survive an export from one instance and an
// import into a SEPARATE fresh instance. Built-ins are excluded from the export
// (they ship with every instance), so this only works if built-in ids are
// deterministic across instances — otherwise the routine's exercise_id points at
// server A's random built-in id, which doesn't exist on server B, the FK doesn't
// resolve, and sync.Push aborts the whole batch. This test fails before the
// deterministic-id fix and passes after it.
func TestExportRestoreReferencesBuiltin(t *testing.T) {
	// --- Source instance A: seed built-ins, build a routine on a built-in, export.
	hA, qA := newTestServer(t)
	if _, err := exercise.SeedBuiltins(context.Background(), qA, time.Now); err != nil {
		t.Fatalf("seed A: %v", err)
	}
	a := registerUser(t, hA, "restore-src@b.com")

	// Pick a built-in exercise from A's library.
	rec := doReq(t, hA, http.MethodGet, "/api/v1/exercises", a, nil)
	var listA listResp
	mustJSON(t, rec, &listA)
	var builtinID string
	for _, e := range listA.Exercises {
		if e.IsBuiltin {
			builtinID = e.ID
			break
		}
	}
	if builtinID == "" {
		t.Fatal("expected a built-in exercise on server A")
	}

	// A routine referencing that built-in exercise.
	rec = doReq(t, hA, http.MethodPost, "/api/v1/routines", a, map[string]any{
		"title": "Built-in Day",
		"exercises": []map[string]any{{
			"exercise_id": builtinID, "rest_seconds": 90,
			"sets": []map[string]any{{"set_type": "normal", "target_reps": 5, "target_weight": 60}},
		}},
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create routine = %d: %s", rec.Code, rec.Body)
	}

	rec = doReq(t, hA, http.MethodGet, "/api/v1/export", a, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("export = %d: %s", rec.Code, rec.Body)
	}
	dump := json.RawMessage(append([]byte(nil), rec.Body.Bytes()...))

	// --- Fresh instance B: seed built-ins, register, import the dump.
	hB, qB := newTestServer(t)
	if _, err := exercise.SeedBuiltins(context.Background(), qB, time.Now); err != nil {
		t.Fatalf("seed B: %v", err)
	}
	b := registerUser(t, hB, "restore-dst@b.com")

	rec = doReq(t, hB, http.MethodPost, "/api/v1/import", b, dump)
	if rec.Code != http.StatusOK {
		t.Fatalf("import = %d: %s", rec.Code, rec.Body)
	}
	var res struct {
		Imported struct {
			Exercises, Folders, Routines, Workouts int
		} `json:"imported"`
	}
	mustJSON(t, rec, &res)
	// The built-in is excluded from the export, so no exercises import; the routine
	// referencing it must still land (this is the FK that used to abort the batch).
	if res.Imported.Routines != 1 {
		t.Fatalf("imported routines = %d, want 1 (built-in FK must resolve on B)", res.Imported.Routines)
	}

	// The imported routine's exercise_id must resolve to a built-in that exists on B.
	// Use B's export (ListFull) — it nests routine exercises, unlike the list summary.
	rec = doReq(t, hB, http.MethodGet, "/api/v1/export", b, nil)
	var exp struct {
		Routines []routine.Routine `json:"routines"`
	}
	mustJSON(t, rec, &exp)
	if len(exp.Routines) != 1 {
		t.Fatalf("routines on B = %d, want 1", len(exp.Routines))
	}
	if len(exp.Routines[0].Exercises) != 1 {
		t.Fatalf("imported routine exercises = %d, want 1", len(exp.Routines[0].Exercises))
	}
	refID := exp.Routines[0].Exercises[0].ExerciseID

	rec = doReq(t, hB, http.MethodGet, "/api/v1/exercises", b, nil)
	var listB listResp
	mustJSON(t, rec, &listB)
	var found *exerciseResponse
	for i := range listB.Exercises {
		if listB.Exercises[i].ID == refID {
			found = &listB.Exercises[i]
			break
		}
	}
	if found == nil {
		t.Fatalf("imported routine references exercise_id %q, which does not exist on B", refID)
	}
	if !found.IsBuiltin {
		t.Fatalf("resolved exercise %q is not a built-in on B", found.ID)
	}
}
