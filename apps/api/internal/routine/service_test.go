package routine

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
	exID := makeExercise(t, q, uid, "Bench Press")
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

func sampleRoutine(exID string) RoutineInput {
	return RoutineInput{
		Title: "Push Day",
		Exercises: []ExerciseInput{{
			ExerciseID:  exID,
			RestSeconds: 90,
			Sets: []SetInput{
				{SetType: "warmup", TargetWeight: fptr(40), TargetReps: iptr(10)},
				{SetType: "normal", TargetWeight: fptr(80), TargetReps: iptr(5)},
			},
		}},
	}
}

func TestFolderCRUD(t *testing.T) {
	s, _, uid, _ := newTestService(t)
	ctx := context.Background()

	f, err := s.CreateFolder(ctx, uid, FolderInput{Name: "Strength"})
	if err != nil || f.ID == "" {
		t.Fatalf("create folder: %v", err)
	}
	if list, _ := s.ListFolders(ctx, uid); len(list) != 1 {
		t.Fatalf("list folders = %d, want 1", len(list))
	}
	if _, err := s.UpdateFolder(ctx, uid, f.ID, FolderInput{Name: "Hypertrophy"}); err != nil {
		t.Fatalf("update folder: %v", err)
	}
	if err := s.DeleteFolder(ctx, uid, f.ID); err != nil {
		t.Fatalf("delete folder: %v", err)
	}
	if list, _ := s.ListFolders(ctx, uid); len(list) != 0 {
		t.Fatalf("list after delete = %d, want 0", len(list))
	}
}

func TestRoutineCreateGetNested(t *testing.T) {
	s, _, uid, exID := newTestService(t)
	ctx := context.Background()

	created, err := s.Create(ctx, uid, sampleRoutine(exID))
	if err != nil {
		t.Fatalf("create routine: %v", err)
	}
	got, err := s.Get(ctx, uid, created.ID)
	if err != nil {
		t.Fatalf("get routine: %v", err)
	}
	if len(got.Exercises) != 1 {
		t.Fatalf("exercises = %d, want 1", len(got.Exercises))
	}
	ex := got.Exercises[0]
	if ex.ExerciseID != exID || ex.RestSeconds != 90 || len(ex.Sets) != 2 {
		t.Fatalf("bad exercise: %+v", ex)
	}
	if ex.Sets[0].SetType != "warmup" || ex.Sets[1].TargetReps == nil || *ex.Sets[1].TargetReps != 5 {
		t.Fatalf("bad sets: %+v", ex.Sets)
	}
}

func TestRoutineUpdateReplacesChildren(t *testing.T) {
	s, q, uid, exID := newTestService(t)
	ctx := context.Background()
	created, err := s.Create(ctx, uid, sampleRoutine(exID))
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	ex2 := makeExercise(t, q, uid, "Squat")
	updated, err := s.Update(ctx, uid, created.ID, RoutineInput{
		Title: "Leg Day",
		Exercises: []ExerciseInput{
			{ExerciseID: exID, Sets: []SetInput{{SetType: "normal"}}},
			{ExerciseID: ex2, Sets: []SetInput{{SetType: "normal"}}},
		},
	})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.Title != "Leg Day" || len(updated.Exercises) != 2 {
		t.Fatalf("update result: %+v", updated)
	}
	// Old children replaced, not accumulated: total sets should be 2, not 4.
	allSets, _ := q.ListRoutineSetsForRoutine(ctx, created.ID)
	if len(allSets) != 2 {
		t.Fatalf("sets after replace = %d, want 2", len(allSets))
	}
}

func TestRoutineListIsMetadataOnly(t *testing.T) {
	s, _, uid, exID := newTestService(t)
	ctx := context.Background()
	if _, err := s.Create(ctx, uid, sampleRoutine(exID)); err != nil {
		t.Fatalf("create: %v", err)
	}
	list, err := s.ListRoutines(ctx, uid)
	if err != nil || len(list) != 1 {
		t.Fatalf("list: %v len=%d", err, len(list))
	}
	if len(list[0].Exercises) != 0 {
		t.Fatalf("list should not include children, got %d", len(list[0].Exercises))
	}
}

func TestRoutineValidation(t *testing.T) {
	s, _, uid, _ := newTestService(t)
	ctx := context.Background()

	_, err := s.Create(ctx, uid, RoutineInput{Title: ""})
	assertCode(t, err, apperr.CodeValidation)

	_, err = s.Create(ctx, uid, RoutineInput{
		Title:     "Bad",
		Exercises: []ExerciseInput{{ExerciseID: "does-not-exist"}},
	})
	assertCode(t, err, apperr.CodeValidation)
}

func TestRoutineCrossUserIsolation(t *testing.T) {
	s, q, uidA, exID := newTestService(t)
	ctx := context.Background()
	uidB := makeUser(t, q, "b@example.com")

	mine, err := s.Create(ctx, uidA, sampleRoutine(exID))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	_, err = s.Get(ctx, uidB, mine.ID)
	assertCode(t, err, apperr.CodeNotFound)
	err = s.Delete(ctx, uidB, mine.ID)
	assertCode(t, err, apperr.CodeNotFound)
	if list, _ := s.ListRoutines(ctx, uidB); len(list) != 0 {
		t.Fatalf("B should see no routines, got %d", len(list))
	}
}

func TestRoutineSoftDelete(t *testing.T) {
	s, _, uid, exID := newTestService(t)
	ctx := context.Background()
	created, err := s.Create(ctx, uid, sampleRoutine(exID))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := s.Delete(ctx, uid, created.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	_, err = s.Get(ctx, uid, created.ID)
	assertCode(t, err, apperr.CodeNotFound)
	if list, _ := s.ListRoutines(ctx, uid); len(list) != 0 {
		t.Fatalf("list after delete = %d, want 0", len(list))
	}
}

func TestFolderValidationAndNotFound(t *testing.T) {
	s, _, uid, _ := newTestService(t)
	ctx := context.Background()

	_, err := s.CreateFolder(ctx, uid, FolderInput{Name: "  "})
	assertCode(t, err, apperr.CodeValidation)

	_, err = s.UpdateFolder(ctx, uid, "nope", FolderInput{Name: ""})
	assertCode(t, err, apperr.CodeValidation)

	_, err = s.UpdateFolder(ctx, uid, "nope", FolderInput{Name: "Renamed"})
	assertCode(t, err, apperr.CodeNotFound)

	err = s.DeleteFolder(ctx, uid, "nope")
	assertCode(t, err, apperr.CodeNotFound)
}

func TestRoutineUpdateNotFoundAndCrossUser(t *testing.T) {
	s, q, uid, exID := newTestService(t)
	ctx := context.Background()

	// Updating a routine that doesn't exist.
	_, err := s.Update(ctx, uid, "nope", sampleRoutine(exID))
	assertCode(t, err, apperr.CodeNotFound)

	// Another user's routine is hidden as NotFound, not Forbidden.
	created, err := s.Create(ctx, uid, sampleRoutine(exID))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	uidB := makeUser(t, q, "cross@example.com")
	exB := makeExercise(t, q, uidB, "B Squat") // uidB must pass validate with their own exercise
	_, err = s.Update(ctx, uidB, created.ID, RoutineInput{
		Title:     "Hijack",
		Exercises: []ExerciseInput{{ExerciseID: exB, Sets: []SetInput{{SetType: "normal"}}}},
	})
	assertCode(t, err, apperr.CodeNotFound)
}

func TestRoutineValidationDetails(t *testing.T) {
	s, _, uid, exID := newTestService(t)
	ctx := context.Background()

	// Unknown folder.
	bad := "no-such-folder"
	_, err := s.Create(ctx, uid, RoutineInput{Title: "X", FolderID: &bad,
		Exercises: []ExerciseInput{{ExerciseID: exID, Sets: []SetInput{{SetType: "normal"}}}}})
	assertCode(t, err, apperr.CodeValidation)

	// Invalid set type.
	_, err = s.Create(ctx, uid, RoutineInput{Title: "X",
		Exercises: []ExerciseInput{{ExerciseID: exID, Sets: []SetInput{{SetType: "bogus"}}}}})
	assertCode(t, err, apperr.CodeValidation)
}

func TestRoutineListFull(t *testing.T) {
	s, _, uid, exID := newTestService(t)
	ctx := context.Background()
	if _, err := s.Create(ctx, uid, sampleRoutine(exID)); err != nil {
		t.Fatalf("create: %v", err)
	}
	full, err := s.ListFull(ctx, uid)
	if err != nil || len(full) != 1 {
		t.Fatalf("listfull: %v len=%d", err, len(full))
	}
	if len(full[0].Exercises) != 1 || len(full[0].Exercises[0].Sets) != 2 {
		t.Fatalf("ListFull should be fully nested: %+v", full[0])
	}
}
