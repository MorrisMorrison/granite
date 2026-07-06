package server

import (
	"net/http"
	"testing"

	"github.com/MorrisMorrison/granite/apps/api/internal/routine"
	"github.com/MorrisMorrison/granite/apps/api/internal/workout"
)

// sdCreateExercise creates a custom exercise over HTTP and returns its id.
func sdCreateExercise(t *testing.T, h http.Handler, token, name string) string {
	t.Helper()
	rec := doReq(t, h, http.MethodPost, "/api/v1/exercises", token, map[string]any{
		"name": name, "exercise_type": "weight_reps", "primary_muscle": "Chest",
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create exercise = %d: %s", rec.Code, rec.Body)
	}
	var ex exerciseResponse
	mustJSON(t, rec, &ex)
	return ex.ID
}

// TestDeleteFolderHandler exercises handleDeleteFolder over HTTP: the happy path
// returns 204 and the folder is gone, while any routine that was in the folder
// survives with its folder_id cleared (referential integrity on soft-delete).
func TestDeleteFolderHandler(t *testing.T) {
	h, _ := newTestServer(t)
	token := registerUser(t, h, "sd-folder@b.com")
	exID := sdCreateExercise(t, h, token, "Bench")

	rec := doReq(t, h, http.MethodPost, "/api/v1/routine-folders", token, map[string]any{"name": "Strength"})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create folder = %d: %s", rec.Code, rec.Body)
	}
	var folder routine.Folder
	mustJSON(t, rec, &folder)

	rec = doReq(t, h, http.MethodPost, "/api/v1/routines", token, map[string]any{
		"title": "Push Day", "folder_id": folder.ID,
		"exercises": []map[string]any{{"exercise_id": exID, "sets": []map[string]any{{"set_type": "normal"}}}},
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create routine = %d: %s", rec.Code, rec.Body)
	}
	var rt routine.Routine
	mustJSON(t, rec, &rt)

	// Delete the folder → 204.
	if rec := doReq(t, h, http.MethodDelete, "/api/v1/routine-folders/"+folder.ID, token, nil); rec.Code != http.StatusNoContent {
		t.Fatalf("delete folder = %d, want 204: %s", rec.Code, rec.Body)
	}

	// The routine still resolves and its folder_id is now null (no dangling ref).
	rec = doReq(t, h, http.MethodGet, "/api/v1/routines/"+rt.ID, token, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("get routine after folder delete = %d: %s", rec.Code, rec.Body)
	}
	var got routine.Routine
	mustJSON(t, rec, &got)
	if got.FolderID != nil {
		t.Fatalf("routine folder_id after folder delete = %v, want nil", got.FolderID)
	}

	// Deleting a folder that no longer exists → 404.
	if rec := doReq(t, h, http.MethodDelete, "/api/v1/routine-folders/"+folder.ID, token, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("re-delete folder = %d, want 404", rec.Code)
	}
}

// TestDeleteRoutineHandler exercises handleDeleteRoutine over HTTP: 204 on
// success, the routine is then gone (404), and re-deleting returns 404.
func TestDeleteRoutineHandler(t *testing.T) {
	h, _ := newTestServer(t)
	token := registerUser(t, h, "sd-routine@b.com")
	exID := sdCreateExercise(t, h, token, "Squat")

	rec := doReq(t, h, http.MethodPost, "/api/v1/routines", token, map[string]any{
		"title": "Leg Day",
		"exercises": []map[string]any{{"exercise_id": exID, "sets": []map[string]any{{"set_type": "normal"}}}},
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create routine = %d: %s", rec.Code, rec.Body)
	}
	var rt routine.Routine
	mustJSON(t, rec, &rt)

	if rec := doReq(t, h, http.MethodDelete, "/api/v1/routines/"+rt.ID, token, nil); rec.Code != http.StatusNoContent {
		t.Fatalf("delete routine = %d, want 204: %s", rec.Code, rec.Body)
	}
	if rec := doReq(t, h, http.MethodGet, "/api/v1/routines/"+rt.ID, token, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("get routine after delete = %d, want 404", rec.Code)
	}
	if rec := doReq(t, h, http.MethodDelete, "/api/v1/routines/"+rt.ID, token, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("re-delete routine = %d, want 404", rec.Code)
	}
}

// TestDeleteWorkoutHandler exercises handleDeleteWorkout over HTTP: 204 on
// success, the workout is then gone (404), and re-deleting returns 404.
func TestDeleteWorkoutHandler(t *testing.T) {
	h, _ := newTestServer(t)
	token := registerUser(t, h, "sd-workout@b.com")
	exID := sdCreateExercise(t, h, token, "Deadlift")

	rec := doReq(t, h, http.MethodPost, "/api/v1/workouts", token, map[string]any{
		"title": "Session", "start_time": 1000,
		"exercises": []map[string]any{{"exercise_id": exID, "sets": []map[string]any{{"set_type": "normal", "weight": 100, "reps": 5, "is_completed": true}}}},
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create workout = %d: %s", rec.Code, rec.Body)
	}
	var w workout.Workout
	mustJSON(t, rec, &w)

	if rec := doReq(t, h, http.MethodDelete, "/api/v1/workouts/"+w.ID, token, nil); rec.Code != http.StatusNoContent {
		t.Fatalf("delete workout = %d, want 204: %s", rec.Code, rec.Body)
	}
	if rec := doReq(t, h, http.MethodGet, "/api/v1/workouts/"+w.ID, token, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("get workout after delete = %d, want 404", rec.Code)
	}
	if rec := doReq(t, h, http.MethodDelete, "/api/v1/workouts/"+w.ID, token, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("re-delete workout = %d, want 404", rec.Code)
	}
}

// TestDeleteInUseExerciseHandler exercises the exercise-delete path over HTTP:
// deleting an exercise still referenced by a routine returns 409 Conflict.
func TestDeleteInUseExerciseHandler(t *testing.T) {
	h, _ := newTestServer(t)
	token := registerUser(t, h, "sd-exuse@b.com")
	exID := sdCreateExercise(t, h, token, "Overhead Press")

	rec := doReq(t, h, http.MethodPost, "/api/v1/routines", token, map[string]any{
		"title": "Push Day",
		"exercises": []map[string]any{{"exercise_id": exID, "sets": []map[string]any{{"set_type": "normal"}}}},
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create routine = %d: %s", rec.Code, rec.Body)
	}

	// The exercise is in use → 409.
	if rec := doReq(t, h, http.MethodDelete, "/api/v1/exercises/"+exID, token, nil); rec.Code != http.StatusConflict {
		t.Fatalf("delete in-use exercise = %d, want 409: %s", rec.Code, rec.Body)
	}
	// It is still resolvable (history stays intact).
	if rec := doReq(t, h, http.MethodGet, "/api/v1/exercises/"+exID, token, nil); rec.Code != http.StatusOK {
		t.Fatalf("get in-use exercise = %d, want 200", rec.Code)
	}
}
