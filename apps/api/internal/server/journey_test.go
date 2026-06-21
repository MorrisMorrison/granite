package server

import (
	"net/http"
	"strings"
	"testing"
)

// TestCoreUserJourney walks the entire core loop as one scenario and asserts the
// cross-feature links hold: register → custom exercise → routine referencing it →
// workout started from that routine → it shows up in history → export contains it →
// a fresh sync pull returns the whole graph. This is the safety net for the
// offline-first refactor: if the core loop breaks, this screams.
func TestCoreUserJourney(t *testing.T) {
	h, _ := newTestServer(t)
	access := registerUser(t, h, "journey@user.com")

	post := func(path string, body any) map[string]any {
		t.Helper()
		rec := doReq(t, h, http.MethodPost, path, access, body)
		if rec.Code != http.StatusCreated {
			t.Fatalf("POST %s = %d: %s", path, rec.Code, rec.Body)
		}
		var m map[string]any
		mustJSON(t, rec, &m)
		return m
	}
	get := func(path string) map[string]any {
		t.Helper()
		rec := doReq(t, h, http.MethodGet, path, access, nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("GET %s = %d: %s", path, rec.Code, rec.Body)
		}
		var m map[string]any
		mustJSON(t, rec, &m)
		return m
	}

	// 1. A custom exercise.
	exID := post("/api/v1/exercises", map[string]any{
		"name": "Back Squat", "exercise_type": "weight_reps", "primary_muscle": "quads",
	})["id"].(string)

	// 2. A routine that references it.
	routineID := post("/api/v1/routines", map[string]any{
		"title": "Leg Day",
		"exercises": []map[string]any{{
			"exercise_id": exID, "rest_seconds": 90,
			"sets": []map[string]any{{"set_type": "normal", "target_weight": 100.0, "target_reps": 5}},
		}},
	})["id"].(string)

	// 3. The routine reads back with its nested graph intact.
	routine := get("/api/v1/routines/" + routineID)
	rexs := routine["exercises"].([]any)
	if len(rexs) != 1 || rexs[0].(map[string]any)["exercise_id"].(string) != exID {
		t.Fatalf("routine exercise link broken: %v", routine["exercises"])
	}

	// 4. A workout started from that routine, with performed sets.
	workoutID := post("/api/v1/workouts", map[string]any{
		"routine_id": routineID, "title": "Leg Day", "start_time": 1000, "end_time": 5000,
		"exercises": []map[string]any{{
			"exercise_id": exID,
			"sets":        []map[string]any{{"set_type": "normal", "weight": 100.0, "reps": 5, "is_completed": true}},
		}},
	})["id"].(string)

	// 5. It shows in history and reads back linked to the routine + exercise.
	history := get("/api/v1/workouts")["workouts"].([]any)
	if !containsID(history, workoutID) {
		t.Fatalf("workout %s missing from history", workoutID)
	}
	workout := get("/api/v1/workouts/" + workoutID)
	if workout["routine_id"].(string) != routineID {
		t.Fatalf("workout routine link = %v, want %s", workout["routine_id"], routineID)
	}
	wexs := workout["exercises"].([]any)
	if len(wexs) != 1 || wexs[0].(map[string]any)["exercise_id"].(string) != exID {
		t.Fatalf("workout exercise link broken: %v", workout["exercises"])
	}

	// 6. Export contains the whole graph (own-your-data).
	rec := doReq(t, h, http.MethodGet, "/api/v1/export", access, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("export = %d", rec.Code)
	}
	body := rec.Body.String()
	for _, id := range []string{exID, routineID, workoutID} {
		if !strings.Contains(body, id) {
			t.Fatalf("export missing id %s", id)
		}
	}

	// 7. A fresh sync pull returns the full graph as changes.
	pulled := pull(t, h, access, 0)
	for _, want := range []struct{ entity, id string }{
		{"exercise", exID}, {"routine", routineID}, {"workout", workoutID},
	} {
		c := findChange(pulled.Changes, want.id)
		if c == nil || c.Entity != want.entity || c.Deleted {
			t.Fatalf("sync pull missing live %s %s: %+v", want.entity, want.id, c)
		}
	}
}

func containsID(items []any, id string) bool {
	for _, it := range items {
		if m, ok := it.(map[string]any); ok {
			if v, _ := m["id"].(string); v == id {
				return true
			}
		}
	}
	return false
}
