package server

import (
	"net/http"
	"testing"
)

// --- helpers ----------------------------------------------------------------

type syncChangeResp struct {
	Entity    string         `json:"entity"`
	ID        string         `json:"id"`
	UpdatedAt int64          `json:"updated_at"`
	Deleted   bool           `json:"deleted"`
	Data      map[string]any `json:"data"`
}

type syncPullResp struct {
	Changes []syncChangeResp `json:"changes"`
	Cursor  int64            `json:"cursor"`
}

type syncPushResp struct {
	Applied []string `json:"applied"`
	Cursor  int64    `json:"cursor"`
}

func pull(t *testing.T, h http.Handler, token string, since int64) syncPullResp {
	t.Helper()
	rec := doReq(t, h, http.MethodPost, "/api/v1/sync/pull", token, map[string]any{"since": since})
	if rec.Code != http.StatusOK {
		t.Fatalf("pull = %d: %s", rec.Code, rec.Body)
	}
	var out syncPullResp
	mustJSON(t, rec, &out)
	return out
}

func push(t *testing.T, h http.Handler, token string, changes ...map[string]any) syncPushResp {
	t.Helper()
	rec := doReq(t, h, http.MethodPost, "/api/v1/sync/push", token, map[string]any{"changes": changes})
	if rec.Code != http.StatusOK {
		t.Fatalf("push = %d: %s", rec.Code, rec.Body)
	}
	var out syncPushResp
	mustJSON(t, rec, &out)
	return out
}

func change(entity, id string, updatedAt int64, deleted bool, data map[string]any) map[string]any {
	return map[string]any{"entity": entity, "id": id, "updated_at": updatedAt, "deleted": deleted, "data": data}
}

func findChange(cs []syncChangeResp, id string) *syncChangeResp {
	for i := range cs {
		if cs[i].ID == id {
			return &cs[i]
		}
	}
	return nil
}

// --- tests ------------------------------------------------------------------

// A full graph pushed from one device is pulled intact (nested) on another.
func TestSyncFullRoundTrip(t *testing.T) {
	h, _ := newTestServer(t)
	token := registerUser(t, h, "sync@a.com")

	exID, folderID, routineID, workoutID := "ex-1", "fld-1", "rt-1", "wk-1"
	res := push(t, h, token,
		change("exercise", exID, 1000, false, map[string]any{
			"name": "Squat", "exercise_type": "weight_reps", "primary_muscle": "quads",
		}),
		change("routine_folder", folderID, 1000, false, map[string]any{"name": "Legs", "order_index": 0}),
		change("routine", routineID, 1100, false, map[string]any{
			"folder_id": folderID, "title": "Leg Day", "notes": "go heavy", "order_index": 0,
			"exercises": []map[string]any{{
				"id": "re-1", "exercise_id": exID, "order_index": 0, "rest_seconds": 120,
				"sets": []map[string]any{{"id": "rs-1", "order_index": 0, "set_type": "normal", "target_weight": 100.0, "target_reps": 5}},
			}},
		}),
		change("workout", workoutID, 1200, false, map[string]any{
			"routine_id": routineID, "title": "Leg Day", "start_time": 1200, "end_time": 5000,
			"exercises": []map[string]any{{
				"id": "we-1", "exercise_id": exID, "order_index": 0,
				"sets": []map[string]any{{"id": "ws-1", "order_index": 0, "set_type": "normal", "weight": 100.0, "reps": 5, "is_completed": true}},
			}},
		}),
	)
	if len(res.Applied) != 4 {
		t.Fatalf("applied = %v, want 4", res.Applied)
	}
	if res.Cursor != 1200 {
		t.Fatalf("push cursor = %d, want 1200", res.Cursor)
	}

	got := pull(t, h, token, 0)
	if len(got.Changes) != 4 {
		t.Fatalf("pull returned %d changes, want 4", len(got.Changes))
	}
	if got.Cursor != 1200 {
		t.Fatalf("pull cursor = %d, want 1200", got.Cursor)
	}

	// FK-dependency order: exercise, folder, routine, workout.
	order := []string{"exercise", "routine_folder", "routine", "workout"}
	for i, want := range order {
		if got.Changes[i].Entity != want {
			t.Fatalf("change[%d].entity = %q, want %q", i, got.Changes[i].Entity, want)
		}
	}

	rt := findChange(got.Changes, routineID)
	exs, ok := rt.Data["exercises"].([]any)
	if !ok || len(exs) != 1 {
		t.Fatalf("routine exercises = %v, want 1", rt.Data["exercises"])
	}
	sets := exs[0].(map[string]any)["sets"].([]any)
	if len(sets) != 1 || sets[0].(map[string]any)["target_reps"].(float64) != 5 {
		t.Fatalf("routine set target_reps wrong: %v", sets)
	}

	wk := findChange(got.Changes, workoutID)
	if wk.Data["routine_id"].(string) != routineID {
		t.Fatalf("workout routine_id = %v", wk.Data["routine_id"])
	}
}

// Incremental pull returns only changes at/after the cursor.
func TestSyncIncrementalCursor(t *testing.T) {
	h, _ := newTestServer(t)
	token := registerUser(t, h, "sync@inc.com")

	push(t, h, token, change("exercise", "ex-old", 1000, false, map[string]any{"name": "Old", "primary_muscle": "x"}))
	first := pull(t, h, token, 0)
	cursor := first.Cursor

	push(t, h, token, change("exercise", "ex-new", 2000, false, map[string]any{"name": "New", "primary_muscle": "y"}))
	second := pull(t, h, token, cursor+1)
	if len(second.Changes) != 1 || second.Changes[0].ID != "ex-new" {
		t.Fatalf("incremental pull = %v, want just ex-new", second.Changes)
	}
}

// Last-write-wins: a newer update is applied; an older one is rejected.
func TestSyncLWW(t *testing.T) {
	h, _ := newTestServer(t)
	token := registerUser(t, h, "sync@lww.com")
	id := "ex-lww"

	push(t, h, token, change("exercise", id, 2000, false, map[string]any{"name": "V2", "primary_muscle": "x"}))

	// Older write: rejected.
	res := push(t, h, token, change("exercise", id, 1000, false, map[string]any{"name": "V1-stale", "primary_muscle": "x"}))
	if len(res.Applied) != 0 {
		t.Fatalf("stale write applied = %v, want none", res.Applied)
	}
	got := pull(t, h, token, 0)
	if findChange(got.Changes, id).Data["name"].(string) != "V2" {
		t.Fatalf("name = %v, want V2 (stale write should not win)", findChange(got.Changes, id).Data["name"])
	}

	// Newer write: applied.
	push(t, h, token, change("exercise", id, 3000, false, map[string]any{"name": "V3", "primary_muscle": "x"}))
	got = pull(t, h, token, 0)
	if findChange(got.Changes, id).Data["name"].(string) != "V3" {
		t.Fatalf("name = %v, want V3", findChange(got.Changes, id).Data["name"])
	}
}

// Deletions propagate as tombstones.
func TestSyncTombstone(t *testing.T) {
	h, _ := newTestServer(t)
	token := registerUser(t, h, "sync@tomb.com")
	id := "ex-tomb"

	push(t, h, token, change("exercise", id, 1000, false, map[string]any{"name": "Doomed", "primary_muscle": "x"}))
	push(t, h, token, change("exercise", id, 2000, true, map[string]any{"name": "Doomed", "primary_muscle": "x"}))

	got := pull(t, h, token, 0)
	c := findChange(got.Changes, id)
	if c == nil || !c.Deleted {
		t.Fatalf("tombstone not propagated: %+v", c)
	}
}

// Re-pushing the same changes is idempotent (no duplicates on pull).
func TestSyncIdempotent(t *testing.T) {
	h, _ := newTestServer(t)
	token := registerUser(t, h, "sync@idem.com")
	c := change("exercise", "ex-idem", 1000, false, map[string]any{"name": "Once", "primary_muscle": "x"})

	push(t, h, token, c)
	push(t, h, token, c)

	got := pull(t, h, token, 0)
	if len(got.Changes) != 1 {
		t.Fatalf("pull returned %d changes after duplicate push, want 1", len(got.Changes))
	}
}

// One user never sees another user's data.
func TestSyncUserIsolation(t *testing.T) {
	h, _ := newTestServer(t)
	tokenA := registerUser(t, h, "sync@iso-a.com")
	tokenB := registerUser(t, h, "sync@iso-b.com")

	push(t, h, tokenA, change("exercise", "ex-a", 1000, false, map[string]any{"name": "A's", "primary_muscle": "x"}))

	got := pull(t, h, tokenB, 0)
	if len(got.Changes) != 0 {
		t.Fatalf("user B saw %d changes, want 0 (isolation breach)", len(got.Changes))
	}
}

// A push that references another user's record id cannot hijack it.
func TestSyncCannotOverwriteOthersRecord(t *testing.T) {
	h, _ := newTestServer(t)
	tokenA := registerUser(t, h, "sync@own-a.com")
	tokenB := registerUser(t, h, "sync@own-b.com")
	id := "ex-shared"

	push(t, h, tokenA, change("exercise", id, 1000, false, map[string]any{"name": "A owns this", "primary_muscle": "x"}))
	res := push(t, h, tokenB, change("exercise", id, 5000, false, map[string]any{"name": "B hijack", "primary_muscle": "x"}))
	if len(res.Applied) != 0 {
		t.Fatalf("B's hijack applied = %v, want none", res.Applied)
	}
	got := pull(t, h, tokenA, 0)
	if findChange(got.Changes, id).Data["name"].(string) != "A owns this" {
		t.Fatalf("A's record was overwritten: %v", findChange(got.Changes, id).Data["name"])
	}
}
