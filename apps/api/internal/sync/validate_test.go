package sync

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/MorrisMorrison/granite/apps/api/internal/apperr"
)

// assertValidation runs a push that must fail with an apperr.Validation (→ 400).
func assertValidation(t *testing.T, s *Service, uid string, c Change) {
	t.Helper()
	_, err := s.Push(context.Background(), uid, []Change{c})
	if err == nil {
		t.Fatal("expected validation error, got nil")
	}
	var ae *apperr.Error
	if !errors.As(err, &ae) || ae.Code != apperr.CodeValidation {
		t.Fatalf("expected apperr.Validation, got %v", err)
	}
}

// FIX 1 — invalid set_type is rejected and nothing is persisted.
func TestPushInvalidSetTypeRejected(t *testing.T) {
	s, _, uid, exID := newTestService(t)
	id := "rt-badset"
	assertValidation(t, s, uid, mkChange(EntityRoutine, id, 1000, false, routineData{
		Title: "Leg Day",
		Exercises: []routineExerciseData{{
			ID: "re-1", ExerciseID: exID, OrderIndex: 0,
			Sets: []routineSetData{{ID: "rs-1", OrderIndex: 0, SetType: "bogus"}},
		}},
	}))

	// Nothing persisted: the routine must not appear on pull.
	changes, _ := mustPull(t, s, uid, 0)
	if findChange(changes, id) != nil {
		t.Fatal("invalid routine was persisted despite validation error")
	}
}

// FIX 1 — an invalid workout set_type is likewise rejected.
func TestPushInvalidWorkoutSetTypeRejected(t *testing.T) {
	s, _, uid, exID := newTestService(t)
	id := "wo-badset"
	assertValidation(t, s, uid, mkChange(EntityWorkout, id, 1000, false, workoutData{
		Title: "Session", StartTime: 1000,
		Exercises: []workoutExerciseData{{
			ID: "we-1", ExerciseID: exID, OrderIndex: 0,
			Sets: []workoutSetData{{ID: "ws-1", OrderIndex: 0, SetType: "nope"}},
		}},
	}))

	changes, _ := mustPull(t, s, uid, 0)
	if findChange(changes, id) != nil {
		t.Fatal("invalid workout was persisted despite validation error")
	}
}

// FIX 1 — an empty (whitespace-only) routine title is rejected, nothing persisted.
func TestPushEmptyRoutineTitleRejected(t *testing.T) {
	s, _, uid, _ := newTestService(t)
	id := "rt-notitle"
	assertValidation(t, s, uid, mkChange(EntityRoutine, id, 1000, false, routineData{
		Title: "   ",
	}))

	changes, _ := mustPull(t, s, uid, 0)
	if findChange(changes, id) != nil {
		t.Fatal("titleless routine was persisted despite validation error")
	}
}

// FIX 1 — an empty workout title is rejected, nothing persisted.
func TestPushEmptyWorkoutTitleRejected(t *testing.T) {
	s, _, uid, _ := newTestService(t)
	id := "wo-notitle"
	assertValidation(t, s, uid, mkChange(EntityWorkout, id, 1000, false, workoutData{
		Title: "", StartTime: 1000,
	}))

	changes, _ := mustPull(t, s, uid, 0)
	if findChange(changes, id) != nil {
		t.Fatal("titleless workout was persisted despite validation error")
	}
}

// FIX 2 — a far-future client updated_at is clamped to ~now+skew, and a later
// correct-clock edit can still win LWW.
func TestPushClampsFutureUpdatedAt(t *testing.T) {
	s, _, uid, _ := newTestService(t)
	id := "ex-future"

	before := time.Now()
	future := before.Add(365 * 24 * time.Hour).UnixMilli() // a year ahead
	mustPush(t, s, uid, mkChange(EntityExercise, id, future, false, exerciseData{
		Name: "Squat", ExerciseType: "weight_reps", PrimaryMuscle: "quads",
	}))

	changes, _ := mustPull(t, s, uid, 0)
	c := findChange(changes, id)
	if c == nil {
		t.Fatal("exercise not stored")
	}
	maxTS := time.Now().Add(clockSkew).UnixMilli()
	if c.UpdatedAt > maxTS {
		t.Fatalf("updated_at not clamped: got %d, want <= now+skew (%d)", c.UpdatedAt, maxTS)
	}
	if c.UpdatedAt < before.UnixMilli() {
		t.Fatalf("clamped updated_at too small: got %d, want ~now", c.UpdatedAt)
	}

	// A later correct-clock edit must still win — impossible if the future ts had
	// been stored verbatim (its updated_at would dominate LWW for a year).
	later := time.Now().Add(clockSkew).UnixMilli() + 1
	mustPush(t, s, uid, mkChange(EntityExercise, id, later, false, exerciseData{
		Name: "Front Squat", ExerciseType: "weight_reps", PrimaryMuscle: "quads",
	}))

	changes, _ = mustPull(t, s, uid, 0)
	c = findChange(changes, id)
	var d exerciseData
	decode(t, c, &d)
	if d.Name != "Front Squat" {
		t.Fatalf("correct-clock edit did not win after clamp: name = %q", d.Name)
	}
}
