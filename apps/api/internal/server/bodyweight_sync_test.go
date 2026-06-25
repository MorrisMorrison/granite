package server

import "testing"

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

	// Soft-delete tombstone.
	push(t, h, token, change("bodyweight", "bw1", 2000, true, map[string]any{}))
	if !findChange(pull(t, h, token, 0).Changes, "bw1").Deleted {
		t.Fatal("expected a tombstone after delete")
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
