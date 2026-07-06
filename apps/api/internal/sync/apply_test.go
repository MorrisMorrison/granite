package sync

import (
	"context"
	"testing"
)

// fptr / iptr build the *T fields the DTOs use.
func fptr(v float64) *float64 { return &v }
func iptr(v int64) *int64     { return &v }
func sptr(v string) *string   { return &v }

// --- 1. Round-trip per entity ------------------------------------------------

func TestRoundTripExercise(t *testing.T) {
	s, _, uid, _ := newTestService(t)
	id := "ex-rt"
	mustPush(t, s, uid, mkChange(EntityExercise, id, 1000, false, exerciseData{
		Name: "Squat", ExerciseType: "weight_reps", PrimaryMuscle: "quads",
	}))

	changes, _ := mustPull(t, s, uid, 0)
	c := findChange(changes, id)
	if c == nil || c.Entity != EntityExercise || c.UpdatedAt != 1000 || c.Deleted {
		t.Fatalf("exercise not round-tripped: %+v", c)
	}
	var d exerciseData
	decode(t, c, &d)
	if d.Name != "Squat" || d.PrimaryMuscle != "quads" {
		t.Fatalf("exercise data wrong: %+v", d)
	}
}

func TestRoundTripRoutineNested(t *testing.T) {
	s, _, uid, exID := newTestService(t)
	id := "rt-rt"
	mustPush(t, s, uid, mkChange(EntityRoutine, id, 1100, false, routineData{
		Title: "Leg Day", Notes: "heavy", OrderIndex: 0,
		Exercises: []routineExerciseData{{
			ID: "re-1", ExerciseID: exID, OrderIndex: 0, RestSeconds: 120,
			Sets: []routineSetData{
				{ID: "rs-1", OrderIndex: 0, SetType: "warmup", TargetWeight: fptr(40), TargetReps: iptr(10)},
				{ID: "rs-2", OrderIndex: 1, SetType: "normal", TargetWeight: fptr(100), TargetReps: iptr(5)},
			},
		}},
	}))

	changes, _ := mustPull(t, s, uid, 0)
	c := findChange(changes, id)
	var d routineData
	decode(t, c, &d)
	if d.Title != "Leg Day" || len(d.Exercises) != 1 {
		t.Fatalf("routine data wrong: %+v", d)
	}
	ex := d.Exercises[0]
	if ex.ExerciseID != exID || ex.RestSeconds != 120 || len(ex.Sets) != 2 {
		t.Fatalf("routine exercise wrong: %+v", ex)
	}
	if ex.Sets[0].SetType != "warmup" || ex.Sets[1].TargetReps == nil || *ex.Sets[1].TargetReps != 5 {
		t.Fatalf("routine sets wrong: %+v", ex.Sets)
	}
}

func TestRoundTripWorkoutNested(t *testing.T) {
	s, _, uid, exID := newTestService(t)
	id := "wk-rt"
	mustPush(t, s, uid, mkChange(EntityWorkout, id, 1200, false, workoutData{
		Title: "Leg Day", StartTime: 1200, EndTime: iptr(5000),
		Exercises: []workoutExerciseData{{
			ID: "we-1", ExerciseID: exID, OrderIndex: 0,
			Sets: []workoutSetData{
				{ID: "ws-1", OrderIndex: 0, SetType: "normal", Weight: fptr(100), Reps: iptr(5), IsCompleted: true},
			},
		}},
	}))

	changes, _ := mustPull(t, s, uid, 0)
	c := findChange(changes, id)
	var d workoutData
	decode(t, c, &d)
	if d.StartTime != 1200 || d.EndTime == nil || *d.EndTime != 5000 || len(d.Exercises) != 1 {
		t.Fatalf("workout data wrong: %+v", d)
	}
	set := d.Exercises[0].Sets[0]
	if set.Weight == nil || *set.Weight != 100 || set.Reps == nil || *set.Reps != 5 || !set.IsCompleted {
		t.Fatalf("workout set wrong: %+v", set)
	}
}

func TestRoundTripFolder(t *testing.T) {
	s, _, uid, _ := newTestService(t)
	id := "fld-rt"
	mustPush(t, s, uid, mkChange(EntityRoutineFolder, id, 1000, false, folderData{Name: "Legs", OrderIndex: 3}))

	changes, _ := mustPull(t, s, uid, 0)
	c := findChange(changes, id)
	var d folderData
	decode(t, c, &d)
	if d.Name != "Legs" || d.OrderIndex != 3 {
		t.Fatalf("folder data wrong: %+v", d)
	}
}

func TestRoundTripBodyweight(t *testing.T) {
	s, _, uid, _ := newTestService(t)
	id := "bw-rt"
	mustPush(t, s, uid, mkChange(EntityBodyweight, id, 1000, false, bodyweightData{Weight: 82.5, RecordedAt: 999}))

	changes, _ := mustPull(t, s, uid, 0)
	c := findChange(changes, id)
	var d bodyweightData
	decode(t, c, &d)
	if d.Weight != 82.5 || d.RecordedAt != 999 {
		t.Fatalf("bodyweight data wrong: %+v", d)
	}
}

// --- 2. Idempotency ----------------------------------------------------------

func TestIdempotentReplay(t *testing.T) {
	tests := []struct {
		name   string
		change func(exID string) Change
	}{
		{"exercise", func(_ string) Change {
			return mkChange(EntityExercise, "ex-idem", 1000, false, exerciseData{Name: "Once", PrimaryMuscle: "x"})
		}},
		{"folder", func(_ string) Change {
			return mkChange(EntityRoutineFolder, "fld-idem", 1000, false, folderData{Name: "Once"})
		}},
		{"routine", func(exID string) Change {
			return mkChange(EntityRoutine, "rt-idem", 1000, false, routineData{
				Title: "Once", Exercises: []routineExerciseData{{
					ID: "re-idem", ExerciseID: exID, Sets: []routineSetData{{ID: "rs-idem", SetType: "normal"}},
				}},
			})
		}},
		{"workout", func(exID string) Change {
			return mkChange(EntityWorkout, "wk-idem", 1000, false, workoutData{
				Title: "Once", StartTime: 1000, Exercises: []workoutExerciseData{{
					ID: "we-idem", ExerciseID: exID, Sets: []workoutSetData{{ID: "ws-idem", SetType: "normal"}},
				}},
			})
		}},
		{"bodyweight", func(_ string) Change {
			return mkChange(EntityBodyweight, "bw-idem", 1000, false, bodyweightData{Weight: 80})
		}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			s, _, uid, exID := newTestService(t)
			c := tc.change(exID)

			applied1 := mustPush(t, s, uid, c)
			if len(applied1) != 1 {
				t.Fatalf("first push applied = %v, want 1", applied1)
			}
			// Same change again: LWW keeps it (updated_at is not strictly older) so
			// the aggregate paths re-apply, but the pulled state must be identical
			// and there must be exactly one record.
			mustPush(t, s, uid, c)

			changes, _ := mustPull(t, s, uid, 0)
			n := 0
			for i := range changes {
				if changes[i].ID == c.ID {
					n++
				}
			}
			if n != 1 {
				t.Fatalf("%s: pulled %d records after duplicate push, want 1", tc.name, n)
			}
		})
	}
}

// applyExercise reports not-applied on a strictly-older replay (observable
// idempotency signal for the simple-entity path).
func TestIdempotentOlderReplayNotApplied(t *testing.T) {
	s, _, uid, _ := newTestService(t)
	id := "ex-older"
	mustPush(t, s, uid, mkChange(EntityExercise, id, 2000, false, exerciseData{Name: "V2", PrimaryMuscle: "x"}))

	applied, err := s.Push(context.Background(), uid,
		[]Change{mkChange(EntityExercise, id, 1000, false, exerciseData{Name: "V1", PrimaryMuscle: "x"})})
	if err != nil {
		t.Fatalf("push: %v", err)
	}
	if len(applied) != 0 {
		t.Fatalf("older replay applied = %v, want none", applied)
	}
}

// --- 3. LWW atomicity --------------------------------------------------------

// lwwState pulls the current name/title for the id, for asserting which write won.
func TestLWWRejectsOlderThenAcceptsNewer(t *testing.T) {
	tests := []struct {
		name string
		// mk builds a change at the given updatedAt with a distinguishing label.
		mk func(exID string, updatedAt int64, label string) Change
		// label extracts the distinguishing field from a pulled change.
		label func(t *testing.T, c *Change) string
	}{
		{
			name: "exercise",
			mk: func(_ string, u int64, label string) Change {
				return mkChange(EntityExercise, "ex-lww", u, false, exerciseData{Name: label, PrimaryMuscle: "x"})
			},
			label: func(t *testing.T, c *Change) string {
				var d exerciseData
				decode(t, c, &d)
				return d.Name
			},
		},
		{
			name: "routine",
			mk: func(exID string, u int64, label string) Change {
				return mkChange(EntityRoutine, "rt-lww", u, false, routineData{
					Title: label, Exercises: []routineExerciseData{{
						ExerciseID: exID, Sets: []routineSetData{{SetType: "normal"}},
					}},
				})
			},
			label: func(t *testing.T, c *Change) string {
				var d routineData
				decode(t, c, &d)
				return d.Title
			},
		},
		{
			name: "workout",
			mk: func(exID string, u int64, label string) Change {
				return mkChange(EntityWorkout, "wk-lww", u, false, workoutData{
					Title: label, StartTime: u, Exercises: []workoutExerciseData{{
						ExerciseID: exID, Sets: []workoutSetData{{SetType: "normal"}},
					}},
				})
			},
			label: func(t *testing.T, c *Change) string {
				var d workoutData
				decode(t, c, &d)
				return d.Title
			},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			s, _, uid, exID := newTestService(t)

			// T2 lands first.
			c2 := tc.mk(exID, 2000, "T2")
			mustPush(t, s, uid, c2)

			// Older T1: rejected, T2 must survive.
			applied := mustPush(t, s, uid, tc.mk(exID, 1000, "T1-stale"))
			if len(applied) != 0 {
				t.Fatalf("%s: stale T1 applied = %v, want none", tc.name, applied)
			}
			changes, _ := mustPull(t, s, uid, 0)
			if got := tc.label(t, findChange(changes, c2.ID)); got != "T2" {
				t.Fatalf("%s: after stale T1, label = %q, want T2", tc.name, got)
			}

			// Newer T3: wins.
			mustPush(t, s, uid, tc.mk(exID, 3000, "T3"))
			changes, _ = mustPull(t, s, uid, 0)
			if got := tc.label(t, findChange(changes, c2.ID)); got != "T3" {
				t.Fatalf("%s: after T3, label = %q, want T3", tc.name, got)
			}
		})
	}
}

// --- 4. Built-in guard -------------------------------------------------------

func TestBuiltinExerciseGuard(t *testing.T) {
	s, q, uid, _ := newTestService(t)
	builtinID := makeBuiltinExercise(t, q, "Barbell Squat")

	// Rename attempt: not applied.
	applied := mustPush(t, s, uid, mkChange(EntityExercise, builtinID, 5000, false,
		exerciseData{Name: "Hijacked", PrimaryMuscle: "x"}))
	if len(applied) != 0 {
		t.Fatalf("builtin rename applied = %v, want none", applied)
	}

	// Delete attempt: not applied.
	applied = mustPush(t, s, uid, mkChange(EntityExercise, builtinID, 6000, true,
		exerciseData{Name: "Barbell Squat", PrimaryMuscle: "x"}))
	if len(applied) != 0 {
		t.Fatalf("builtin delete applied = %v, want none", applied)
	}

	// Row unchanged: still named "Barbell Squat", not deleted, still user_id NULL.
	got, err := q.GetExerciseForSync(context.Background(), builtinID)
	if err != nil {
		t.Fatalf("get builtin: %v", err)
	}
	if got.Name != "Barbell Squat" || got.DeletedAt.Valid || got.UserID.Valid {
		t.Fatalf("builtin row mutated: name=%q deleted=%v userValid=%v", got.Name, got.DeletedAt.Valid, got.UserID.Valid)
	}
}

// --- 5. Tombstones both directions -------------------------------------------

func TestTombstoneDeleteThenResurrectThenReject(t *testing.T) {
	s, _, uid, _ := newTestService(t)
	id := "ex-tomb"

	mustPush(t, s, uid, mkChange(EntityExercise, id, 1000, false, exerciseData{Name: "Alive", PrimaryMuscle: "x"}))

	// Delete @2000 → tombstone. Pull still returns it, but flagged Deleted.
	mustPush(t, s, uid, mkChange(EntityExercise, id, 2000, true, exerciseData{Name: "Alive", PrimaryMuscle: "x"}))
	changes, _ := mustPull(t, s, uid, 0)
	c := findChange(changes, id)
	if c == nil || !c.Deleted {
		t.Fatalf("delete did not produce tombstone: %+v", c)
	}

	// Edit older than the tombstone (@1500) → rejected, stays deleted.
	applied := mustPush(t, s, uid, mkChange(EntityExercise, id, 1500, false, exerciseData{Name: "Stale", PrimaryMuscle: "x"}))
	if len(applied) != 0 {
		t.Fatalf("pre-tombstone edit applied = %v, want none", applied)
	}
	changes, _ = mustPull(t, s, uid, 0)
	if c = findChange(changes, id); c == nil || !c.Deleted {
		t.Fatalf("stale edit resurrected the record: %+v", c)
	}

	// Edit newer than the tombstone (@3000) → resurrects.
	mustPush(t, s, uid, mkChange(EntityExercise, id, 3000, false, exerciseData{Name: "Reborn", PrimaryMuscle: "x"}))
	changes, _ = mustPull(t, s, uid, 0)
	c = findChange(changes, id)
	if c == nil || c.Deleted {
		t.Fatalf("newer edit did not resurrect: %+v", c)
	}
	var d exerciseData
	decode(t, c, &d)
	if d.Name != "Reborn" {
		t.Fatalf("resurrected name = %q, want Reborn", d.Name)
	}
}

// --- 6. Incremental pull cursor ----------------------------------------------

func TestIncrementalPullCursor(t *testing.T) {
	s, _, uid, _ := newTestService(t)

	mustPush(t, s, uid, mkChange(EntityExercise, "ex-a", 1000, false, exerciseData{Name: "A", PrimaryMuscle: "x"}))
	first, cursor := mustPull(t, s, uid, 0)
	if findChange(first, "ex-a") == nil {
		t.Fatalf("first pull missing ex-a: %+v", first)
	}
	if cursor <= 0 {
		t.Fatalf("cursor = %d, want > 0", cursor)
	}

	mustPush(t, s, uid, mkChange(EntityExercise, "ex-b", 2000, false, exerciseData{Name: "B", PrimaryMuscle: "y"}))
	second, cursor2 := mustPull(t, s, uid, cursor)
	if len(second) != 1 || second[0].ID != "ex-b" {
		t.Fatalf("incremental pull = %+v, want only ex-b", second)
	}
	if cursor2 <= cursor {
		t.Fatalf("cursor did not advance: %d -> %d", cursor, cursor2)
	}

	// Re-pull from the latest cursor: nothing new (strict >).
	third, _ := mustPull(t, s, uid, cursor2)
	if len(third) != 0 {
		t.Fatalf("re-pull from cursor returned %d changes, want 0", len(third))
	}
}

// --- 4b. Cross-user ownership guard (aggregate + simple paths) ---------------

// A second user cannot overwrite a record another user owns, even with a newer
// updated_at — the ownership check short-circuits before the upsert.
func TestCrossUserCannotOverwrite(t *testing.T) {
	tests := []struct {
		name  string
		mkA   func(exA string) Change // owner A's create
		mkB   func(exB, id string) Change
		label func(t *testing.T, c *Change) string
	}{
		{
			name: "folder",
			mkA:  func(_ string) Change { return mkChange(EntityRoutineFolder, "fld-own", 1000, false, folderData{Name: "A owns"}) },
			mkB:  func(_, id string) Change { return mkChange(EntityRoutineFolder, id, 5000, false, folderData{Name: "B hijack"}) },
			label: func(t *testing.T, c *Change) string {
				var d folderData
				decode(t, c, &d)
				return d.Name
			},
		},
		{
			name: "routine",
			mkA: func(exA string) Change {
				return mkChange(EntityRoutine, "rt-own", 1000, false, routineData{
					Title: "A owns", Exercises: []routineExerciseData{{ExerciseID: exA, Sets: []routineSetData{{SetType: "normal"}}}},
				})
			},
			mkB: func(exB, id string) Change {
				return mkChange(EntityRoutine, id, 5000, false, routineData{
					Title: "B hijack", Exercises: []routineExerciseData{{ExerciseID: exB, Sets: []routineSetData{{SetType: "normal"}}}},
				})
			},
			label: func(t *testing.T, c *Change) string {
				var d routineData
				decode(t, c, &d)
				return d.Title
			},
		},
		{
			name: "workout",
			mkA: func(exA string) Change {
				return mkChange(EntityWorkout, "wk-own", 1000, false, workoutData{
					Title: "A owns", StartTime: 1000, Exercises: []workoutExerciseData{{ExerciseID: exA, Sets: []workoutSetData{{SetType: "normal"}}}},
				})
			},
			mkB: func(exB, id string) Change {
				return mkChange(EntityWorkout, id, 5000, false, workoutData{
					Title: "B hijack", StartTime: 5000, Exercises: []workoutExerciseData{{ExerciseID: exB, Sets: []workoutSetData{{SetType: "normal"}}}},
				})
			},
			label: func(t *testing.T, c *Change) string {
				var d workoutData
				decode(t, c, &d)
				return d.Title
			},
		},
		{
			name: "bodyweight",
			mkA:  func(_ string) Change { return mkChange(EntityBodyweight, "bw-own", 1000, false, bodyweightData{Weight: 80}) },
			mkB:  func(_, id string) Change { return mkChange(EntityBodyweight, id, 5000, false, bodyweightData{Weight: 999}) },
			label: func(t *testing.T, c *Change) string {
				var d bodyweightData
				decode(t, c, &d)
				if d.Weight == 80 {
					return "A owns"
				}
				return "B hijack"
			},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			s, q, uidA, exA := newTestService(t)
			uidB := makeUser(t, q, "b-"+tc.name+"@example.com")
			exB := makeExercise(t, q, uidB, "B Exercise")

			cA := tc.mkA(exA)
			mustPush(t, s, uidA, cA)

			applied := mustPush(t, s, uidB, tc.mkB(exB, cA.ID))
			if len(applied) != 0 {
				t.Fatalf("%s: B's hijack applied = %v, want none", tc.name, applied)
			}
			// A still owns it, unchanged.
			changes, _ := mustPull(t, s, uidA, 0)
			if got := tc.label(t, findChange(changes, cA.ID)); got != "A owns" {
				t.Fatalf("%s: record label = %q, want 'A owns'", tc.name, got)
			}
			// B never sees it.
			bChanges, _ := mustPull(t, s, uidB, 0)
			if findChange(bChanges, cA.ID) != nil {
				t.Fatalf("%s: B pulled A's record (isolation breach)", tc.name)
			}
		})
	}
}

// Sanity: a folder_id pointer round-trips through routineData (nil vs set).
func TestRoutineFolderPointerRoundTrip(t *testing.T) {
	s, _, uid, exID := newTestService(t)
	folderID := "fld-ptr"
	mustPush(t, s, uid, mkChange(EntityRoutineFolder, folderID, 1000, false, folderData{Name: "Legs"}))
	mustPush(t, s, uid, mkChange(EntityRoutine, "rt-ptr", 1100, false, routineData{
		FolderID: sptr(folderID), Title: "In Folder",
		Exercises: []routineExerciseData{{ExerciseID: exID, Sets: []routineSetData{{SetType: "normal"}}}},
	}))
	changes, _ := mustPull(t, s, uid, 0)
	var d routineData
	decode(t, findChange(changes, "rt-ptr"), &d)
	if d.FolderID == nil || *d.FolderID != folderID {
		t.Fatalf("folder_id pointer wrong: %+v", d.FolderID)
	}
}
