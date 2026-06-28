package workout

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"testing"

	"github.com/google/uuid"

	"github.com/MorrisMorrison/granite/apps/api/internal/apperr"
	"github.com/MorrisMorrison/granite/apps/api/internal/db"
	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
)

func newTestService(t *testing.T) (*Service, *sqlc.Queries, string, string) {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	if err := db.Migrate(database); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	q := sqlc.New(database)
	uid := makeUser(t, q, "a@example.com")
	exID := makeExercise(t, q, uid, "Bench")
	return NewService(database, q), q, uid, exID
}

func makeUser(t *testing.T, q *sqlc.Queries, email string) string {
	t.Helper()
	id := uuid.NewString()
	if _, err := q.CreateUser(context.Background(), sqlc.CreateUserParams{
		ID: id, Email: email, PasswordHash: "x", Settings: "{}", CreatedAt: 0, UpdatedAt: 0,
	}); err != nil {
		t.Fatalf("create user: %v", err)
	}
	return id
}

func makeExercise(t *testing.T, q *sqlc.Queries, userID, name string) string {
	t.Helper()
	id := uuid.NewString()
	if _, err := q.CreateExercise(context.Background(), sqlc.CreateExerciseParams{
		ID: id, UserID: sql.NullString{String: userID, Valid: true}, Name: name,
		ExerciseType: "weight_reps", SecondaryMuscles: "[]", CreatedAt: 0, UpdatedAt: 0,
	}); err != nil {
		t.Fatalf("create exercise: %v", err)
	}
	return id
}

func assertCode(t *testing.T, err error, want apperr.Code) {
	t.Helper()
	var ae *apperr.Error
	if !errors.As(err, &ae) {
		t.Fatalf("expected *apperr.Error, got %v", err)
	}
	if ae.Code != want {
		t.Fatalf("error code = %q, want %q", ae.Code, want)
	}
}

func fptr(v float64) *float64 { return &v }
func iptr(v int) *int         { return &v }

func sample(exID string) WorkoutInput {
	return WorkoutInput{
		Title:     "Morning",
		StartTime: 1000,
		Exercises: []WorkoutExerciseInput{{
			ExerciseID: exID,
			Sets: []WorkoutSetInput{
				{SetType: "normal", Weight: fptr(80), Reps: iptr(5), IsCompleted: true},
				{SetType: "normal", Weight: fptr(80), Reps: iptr(4)},
			},
		}},
	}
}

func TestCreateGetNested(t *testing.T) {
	s, _, uid, exID := newTestService(t)
	ctx := context.Background()
	created, err := s.Create(ctx, uid, sample(exID))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	got, err := s.Get(ctx, uid, created.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if len(got.Exercises) != 1 || len(got.Exercises[0].Sets) != 2 {
		t.Fatalf("nested wrong: %+v", got)
	}
	s0 := got.Exercises[0].Sets[0]
	if s0.Weight == nil || *s0.Weight != 80 || !s0.IsCompleted {
		t.Fatalf("set values wrong: %+v", s0)
	}
	if got.Exercises[0].Sets[1].IsCompleted {
		t.Fatal("second set should be incomplete")
	}
}

func TestStartTimeDefaults(t *testing.T) {
	s, _, uid, exID := newTestService(t)
	in := sample(exID)
	in.StartTime = 0
	w, err := s.Create(context.Background(), uid, in)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if w.StartTime == 0 {
		t.Fatal("start_time should default to now when 0")
	}
}

func TestUpdateReplacesChildren(t *testing.T) {
	s, q, uid, exID := newTestService(t)
	ctx := context.Background()
	created, err := s.Create(ctx, uid, sample(exID))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := s.Update(ctx, uid, created.ID, WorkoutInput{
		Title:     "Edited",
		Exercises: []WorkoutExerciseInput{{ExerciseID: exID, Sets: []WorkoutSetInput{{SetType: "normal"}}}},
	}); err != nil {
		t.Fatalf("update: %v", err)
	}
	sets, _ := q.ListWorkoutSetsForWorkout(ctx, created.ID)
	if len(sets) != 1 {
		t.Fatalf("sets after replace = %d, want 1", len(sets))
	}
}

func TestListAndListFull(t *testing.T) {
	s, _, uid, exID := newTestService(t)
	ctx := context.Background()
	if _, err := s.Create(ctx, uid, sample(exID)); err != nil {
		t.Fatalf("create: %v", err)
	}
	list, _ := s.List(ctx, uid)
	if len(list) != 1 || len(list[0].Exercises) != 0 {
		t.Fatalf("list should be metadata-only: %+v", list)
	}
	full, _ := s.ListFull(ctx, uid)
	if len(full) != 1 || len(full[0].Exercises) != 1 {
		t.Fatalf("ListFull should be nested: %+v", full)
	}
}

func TestValidationAndIsolation(t *testing.T) {
	s, q, uidA, exID := newTestService(t)
	ctx := context.Background()

	_, err := s.Create(ctx, uidA, WorkoutInput{Exercises: []WorkoutExerciseInput{{ExerciseID: "nope"}}})
	assertCode(t, err, apperr.CodeValidation)

	mine, err := s.Create(ctx, uidA, sample(exID))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	uidB := makeUser(t, q, "b@example.com")
	_, err = s.Get(ctx, uidB, mine.ID)
	assertCode(t, err, apperr.CodeNotFound)
	err = s.Delete(ctx, uidB, mine.ID)
	assertCode(t, err, apperr.CodeNotFound)
}

func TestSoftDelete(t *testing.T) {
	s, _, uid, exID := newTestService(t)
	ctx := context.Background()
	created, err := s.Create(ctx, uid, sample(exID))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := s.Delete(ctx, uid, created.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	_, err = s.Get(ctx, uid, created.ID)
	assertCode(t, err, apperr.CodeNotFound)
}

func TestUpdateNotFoundAndCrossUser(t *testing.T) {
	s, q, uid, exID := newTestService(t)
	ctx := context.Background()

	_, err := s.Update(ctx, uid, "nope", sample(exID))
	assertCode(t, err, apperr.CodeNotFound)

	created, err := s.Create(ctx, uid, sample(exID))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	uidB := makeUser(t, q, "wb@example.com")
	exB := makeExercise(t, q, uidB, "B Row") // uidB must pass validate with their own exercise
	_, err = s.Update(ctx, uidB, created.ID, WorkoutInput{
		Title:     "Hijack",
		Exercises: []WorkoutExerciseInput{{ExerciseID: exB, Sets: []WorkoutSetInput{{SetType: "normal"}}}},
	})
	assertCode(t, err, apperr.CodeNotFound)
}

func TestInvalidSetType(t *testing.T) {
	s, _, uid, exID := newTestService(t)
	ctx := context.Background()
	_, err := s.Create(ctx, uid, WorkoutInput{
		Title:     "W",
		Exercises: []WorkoutExerciseInput{{ExerciseID: exID, Sets: []WorkoutSetInput{{SetType: "bogus"}}}},
	})
	assertCode(t, err, apperr.CodeValidation)
}
