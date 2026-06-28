package server

import (
	"net/http"
	"testing"
)

// TestUpdateEndpoints exercises the PATCH handlers (me / routine / workout), which
// the read-only journey test doesn't reach, plus a not-found error path.
func TestUpdateEndpoints(t *testing.T) {
	h, _ := newTestServer(t)
	access := registerUser(t, h, "upd@user.com")

	mkID := func(path string, body any) string {
		t.Helper()
		rec := doReq(t, h, http.MethodPost, path, access, body)
		if rec.Code != http.StatusCreated {
			t.Fatalf("POST %s = %d: %s", path, rec.Code, rec.Body)
		}
		var m map[string]any
		mustJSON(t, rec, &m)
		return m["id"].(string)
	}
	patchOK := func(path string, body any) {
		t.Helper()
		rec := doReq(t, h, http.MethodPatch, path, access, body)
		if rec.Code != http.StatusOK {
			t.Fatalf("PATCH %s = %d: %s", path, rec.Code, rec.Body)
		}
	}

	// PATCH /me — display name + settings.
	patchOK("/api/v1/me", map[string]any{
		"display_name": "Updated", "settings": map[string]any{"weightUnit": "lb"},
	})

	exID := mkID("/api/v1/exercises", map[string]any{
		"name": "Squat", "exercise_type": "weight_reps", "primary_muscle": "quads",
	})
	routineID := mkID("/api/v1/routines", map[string]any{
		"title": "Day",
		"exercises": []map[string]any{{
			"exercise_id": exID, "rest_seconds": 90,
			"sets": []map[string]any{{"set_type": "normal", "target_weight": 100.0, "target_reps": 5}},
		}},
	})
	workoutID := mkID("/api/v1/workouts", map[string]any{
		"title": "Day", "start_time": 1000,
		"exercises": []map[string]any{{
			"exercise_id": exID,
			"sets":        []map[string]any{{"set_type": "normal", "weight": 100.0, "reps": 5, "is_completed": true}},
		}},
	})

	patchOK("/api/v1/routines/"+routineID, map[string]any{
		"title": "Renamed",
		"exercises": []map[string]any{{
			"exercise_id": exID, "sets": []map[string]any{{"set_type": "normal"}},
		}},
	})
	patchOK("/api/v1/workouts/"+workoutID, map[string]any{
		"title": "Renamed", "start_time": 1000,
		"exercises": []map[string]any{{
			"exercise_id": exID, "sets": []map[string]any{{"set_type": "normal", "weight": 110.0, "reps": 5}},
		}},
	})

	// A missing routine maps to 404 (the error-handling branch of the handler).
	rec := doReq(t, h, http.MethodPatch, "/api/v1/routines/nope", access, map[string]any{
		"title":     "X",
		"exercises": []map[string]any{{"exercise_id": exID, "sets": []map[string]any{{"set_type": "normal"}}}},
	})
	if rec.Code != http.StatusNotFound {
		t.Fatalf("PATCH missing routine = %d, want 404: %s", rec.Code, rec.Body)
	}
}

// TestEndpointErrorPaths covers the not-found and validation branches of the read
// and create handlers (the happy paths are in the journey test).
func TestEndpointErrorPaths(t *testing.T) {
	h, _ := newTestServer(t)
	access := registerUser(t, h, "errs@user.com")

	notFound := func(path string) {
		t.Helper()
		rec := doReq(t, h, http.MethodGet, path, access, nil)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("GET %s = %d, want 404: %s", path, rec.Code, rec.Body)
		}
	}
	notFound("/api/v1/routines/nope")
	notFound("/api/v1/workouts/nope")
	notFound("/api/v1/exercises/nope")

	// Invalid create (blank title) hits the handler's error branch (4xx, not 5xx).
	rec := doReq(t, h, http.MethodPost, "/api/v1/routines", access, map[string]any{"title": ""})
	if rec.Code < 400 || rec.Code >= 500 {
		t.Fatalf("POST invalid routine = %d, want 4xx: %s", rec.Code, rec.Body)
	}
}
