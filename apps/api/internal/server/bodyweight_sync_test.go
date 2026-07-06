package server

import (
	"encoding/json"
	"net/http"
	"testing"
)

func TestSyncBodyweightRoundTrip(t *testing.T) {
	h, _ := newTestServer(t)
	token := registerUser(t, h, "bw@example.com")

	push(t, h, token, change("bodyweight", "bw1", 1000, false, map[string]any{
		"weight": 82.5, "recorded_at": 1700000000000, "created_at": 1000,
	}))

	c := findChange(pull(t, h, token, 0).Changes, "bw1")
	if c == nil {
		t.Fatal("bodyweight not returned by pull")
	}
	if c.Entity != "bodyweight" || c.Data["weight"].(float64) != 82.5 {
		t.Fatalf("unexpected change: %+v", c)
	}

	// LWW: a newer update wins.
	push(t, h, token, change("bodyweight", "bw1", 1500, false, map[string]any{
		"weight": 83.0, "recorded_at": 1700000000000, "created_at": 1000,
	}))
	if findChange(pull(t, h, token, 0).Changes, "bw1").Data["weight"].(float64) != 83.0 {
		t.Fatal("newer weight should win")
	}

	// LWW: an older update is ignored.
	push(t, h, token, change("bodyweight", "bw1", 1200, false, map[string]any{
		"weight": 70.0, "recorded_at": 1, "created_at": 1,
	}))
	if findChange(pull(t, h, token, 0).Changes, "bw1").Data["weight"].(float64) != 83.0 {
		t.Fatal("older update should be ignored")
	}

	// Soft-delete tombstone.
	push(t, h, token, change("bodyweight", "bw1", 2000, true, map[string]any{}))
	if !findChange(pull(t, h, token, 0).Changes, "bw1").Deleted {
		t.Fatal("expected a tombstone after delete")
	}
}

func TestSyncBodyweightOwnership(t *testing.T) {
	h, _ := newTestServer(t)
	a := registerUser(t, h, "bwown-a@example.com")
	b := registerUser(t, h, "bwown-b@example.com")

	push(t, h, a, change("bodyweight", "shared", 1000, false, map[string]any{
		"weight": 80.0, "recorded_at": 1, "created_at": 1,
	}))
	// B can't clobber A's record id, even with a newer timestamp.
	res := push(t, h, b, change("bodyweight", "shared", 2000, false, map[string]any{
		"weight": 999.0, "recorded_at": 1, "created_at": 1,
	}))
	if len(res.Applied) != 0 {
		t.Fatalf("B must not clobber A's record; applied=%v", res.Applied)
	}
	if findChange(pull(t, h, a, 0).Changes, "shared").Data["weight"].(float64) != 80.0 {
		t.Fatal("A's weight should be unchanged")
	}
}

func TestImportBodyweight(t *testing.T) {
	h, _ := newTestServer(t)
	token := registerUser(t, h, "bwimport@example.com")

	rec := doReq(t, h, http.MethodPost, "/api/v1/import", token, map[string]any{
		"exercises":       []map[string]any{},
		"routine_folders": []map[string]any{},
		"routines":        []map[string]any{},
		"workouts":        []map[string]any{},
		"bodyweight": []map[string]any{
			{"id": "imp1", "weight": 77.5, "recorded_at": 1700000000000, "created_at": 1000, "updated_at": 1000},
		},
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("import = %d: %s", rec.Code, rec.Body)
	}
	var res struct {
		Imported struct {
			Bodyweight int `json:"bodyweight"`
		} `json:"imported"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("decode import response: %v", err)
	}
	if res.Imported.Bodyweight != 1 {
		t.Fatalf("imported bodyweight count = %d, want 1", res.Imported.Bodyweight)
	}
	c := findChange(pull(t, h, token, 0).Changes, "imp1")
	if c == nil || c.Data["weight"].(float64) != 77.5 {
		t.Fatalf("imported bodyweight not found: %+v", c)
	}
}

func TestExportImportIncludesBodyweight(t *testing.T) {
	h, _ := newTestServer(t)
	token := registerUser(t, h, "bwexport@example.com")
	push(t, h, token, change("bodyweight", "bw1", 1000, false, map[string]any{
		"weight": 80, "recorded_at": 1700000000000, "created_at": 1000,
	}))

	rec := doReq(t, h, "GET", "/api/v1/export", token, nil)
	var dump struct {
		Bodyweight []map[string]any `json:"bodyweight"`
	}
	mustJSON(t, rec, &dump)
	if len(dump.Bodyweight) != 1 || dump.Bodyweight[0]["id"] != "bw1" {
		t.Fatalf("export missing bodyweight: %+v", dump.Bodyweight)
	}
}
