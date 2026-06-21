package server

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/MorrisMorrison/granite/apps/api/internal/routine"
	"github.com/MorrisMorrison/granite/apps/api/internal/workout"
)

func TestImportRoundTrip(t *testing.T) {
	// Source instance: build some data, then export it.
	h1, _ := newTestServer(t)
	a := registerUser(t, h1, "src@b.com")

	rec := doReq(t, h1, http.MethodPost, "/api/v1/exercises", a, map[string]any{
		"name": "Squat", "exercise_type": "weight_reps",
	})
	var ex exerciseResponse
	mustJSON(t, rec, &ex)

	rec = doReq(t, h1, http.MethodPost, "/api/v1/routine-folders", a, map[string]any{"name": "Strength"})
	var folder routine.Folder
	mustJSON(t, rec, &folder)

	rec = doReq(t, h1, http.MethodPost, "/api/v1/routines", a, map[string]any{
		"title": "Push", "folder_id": folder.ID,
		"exercises": []map[string]any{{
			"exercise_id": ex.ID, "rest_seconds": 90,
			"sets": []map[string]any{{"set_type": "normal", "target_reps": 5, "target_weight": 60}},
		}},
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create routine = %d: %s", rec.Code, rec.Body)
	}

	rec = doReq(t, h1, http.MethodPost, "/api/v1/workouts", a, map[string]any{
		"title": "Session", "start_time": 1000,
		"exercises": []map[string]any{{
			"exercise_id": ex.ID,
			"sets":        []map[string]any{{"set_type": "normal", "weight": 80, "reps": 5, "is_completed": true}},
		}},
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create workout = %d: %s", rec.Code, rec.Body)
	}

	rec = doReq(t, h1, http.MethodGet, "/api/v1/export", a, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("export = %d: %s", rec.Code, rec.Body)
	}
	dump := json.RawMessage(append([]byte(nil), rec.Body.Bytes()...))

	// Fresh instance: import the export into a new account.
	h2, _ := newTestServer(t)
	b := registerUser(t, h2, "dst@b.com")

	rec = doReq(t, h2, http.MethodPost, "/api/v1/import", b, dump)
	if rec.Code != http.StatusOK {
		t.Fatalf("import = %d: %s", rec.Code, rec.Body)
	}
	var res struct {
		Imported struct {
			Exercises, Folders, Routines, Workouts int
		} `json:"imported"`
	}
	mustJSON(t, rec, &res)
	if res.Imported.Exercises != 1 || res.Imported.Folders != 1 || res.Imported.Routines != 1 || res.Imported.Workouts != 1 {
		t.Fatalf("import counts = %+v, want 1 of each", res.Imported)
	}

	// The fresh instance now exports the same content (ids + nesting preserved).
	rec = doReq(t, h2, http.MethodGet, "/api/v1/export", b, nil)
	var exp struct {
		Exercises      []exerciseResponse `json:"exercises"`
		RoutineFolders []routine.Folder   `json:"routine_folders"`
		Routines       []routine.Routine  `json:"routines"`
		Workouts       []workout.Workout  `json:"workouts"`
	}
	mustJSON(t, rec, &exp)
	if len(exp.Exercises) != 1 || len(exp.RoutineFolders) != 1 || len(exp.Routines) != 1 || len(exp.Workouts) != 1 {
		t.Fatalf("imported export contents = ex=%d folders=%d routines=%d workouts=%d",
			len(exp.Exercises), len(exp.RoutineFolders), len(exp.Routines), len(exp.Workouts))
	}
	r := exp.Routines[0]
	if r.Title != "Push" || r.FolderID == nil || *r.FolderID != folder.ID {
		t.Fatalf("imported routine wrong: %+v", r)
	}
	if len(r.Exercises) != 1 || len(r.Exercises[0].Sets) != 1 || r.Exercises[0].Sets[0].TargetReps == nil || *r.Exercises[0].Sets[0].TargetReps != 5 {
		t.Fatalf("imported routine sets wrong: %+v", r.Exercises)
	}
	if w := exp.Workouts[0]; len(w.Exercises) != 1 || len(w.Exercises[0].Sets) != 1 || !w.Exercises[0].Sets[0].IsCompleted {
		t.Fatalf("imported workout wrong: %+v", exp.Workouts[0])
	}

	// Re-importing the same dump is idempotent — no duplicates.
	rec = doReq(t, h2, http.MethodPost, "/api/v1/import", b, dump)
	if rec.Code != http.StatusOK {
		t.Fatalf("re-import = %d: %s", rec.Code, rec.Body)
	}
	rec = doReq(t, h2, http.MethodGet, "/api/v1/routines", b, nil)
	var list struct {
		Routines []routine.Routine `json:"routines"`
	}
	mustJSON(t, rec, &list)
	if len(list.Routines) != 1 {
		t.Fatalf("routines after re-import = %d, want 1 (idempotent)", len(list.Routines))
	}
}
