package exercise

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"github.com/google/uuid"

	"github.com/MorrisMorrison/granite/apps/api/internal/apperr"
	"github.com/MorrisMorrison/granite/apps/api/internal/db"
	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
)

func newTestService(t *testing.T) (*Service, *sqlc.Queries, string) {
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
	return NewService(q), q, makeUser(t, q, "a@example.com")
}

func makeUser(t *testing.T, q *sqlc.Queries, email string) string {
	t.Helper()
	id := uuid.NewString()
	if _, err := q.CreateUser(context.Background(), sqlc.CreateUserParams{
		ID: id, Email: email, PasswordHash: "x", DisplayName: "", Settings: "{}", CreatedAt: 0, UpdatedAt: 0,
	}); err != nil {
		t.Fatalf("create user: %v", err)
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

func validInput(name string) Input {
	return Input{Name: name, ExerciseType: "weight_reps", PrimaryMuscle: "Chest", Equipment: "Barbell"}
}

func TestCreateGetListUpdateDelete(t *testing.T) {
	s, _, uid := newTestService(t)
	ctx := context.Background()

	created, err := s.Create(ctx, uid, validInput("My Press"))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if created.ID == "" || created.IsBuiltin {
		t.Fatal("created exercise should have an id and not be built-in")
	}

	got, err := s.Get(ctx, uid, created.ID)
	if err != nil || got.Name != "My Press" {
		t.Fatalf("get: %v / %q", err, got.Name)
	}

	list, err := s.List(ctx, uid)
	if err != nil || len(list) != 1 {
		t.Fatalf("list: %v / len=%d", err, len(list))
	}

	upd, err := s.Update(ctx, uid, created.ID, validInput("Renamed Press"))
	if err != nil || upd.Name != "Renamed Press" {
		t.Fatalf("update: %v / %q", err, upd.Name)
	}

	if err := s.Delete(ctx, uid, created.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	_, err = s.Get(ctx, uid, created.ID)
	assertCode(t, err, apperr.CodeNotFound)
	if list, _ := s.List(ctx, uid); len(list) != 0 {
		t.Fatalf("soft-deleted exercise should not be listed, got %d", len(list))
	}
}

func TestBuiltinsAreReadOnly(t *testing.T) {
	s, q, uid := newTestService(t)
	ctx := context.Background()
	if _, err := SeedBuiltins(ctx, q, fixedNow()); err != nil {
		t.Fatalf("seed: %v", err)
	}

	list, _ := s.List(ctx, uid)
	var builtinID string
	for _, e := range list {
		if e.IsBuiltin {
			builtinID = e.ID
			break
		}
	}
	if builtinID == "" {
		t.Fatal("expected a built-in exercise in the list")
	}

	_, err := s.Update(ctx, uid, builtinID, validInput("hacked"))
	assertCode(t, err, apperr.CodeForbidden)
	err = s.Delete(ctx, uid, builtinID)
	assertCode(t, err, apperr.CodeForbidden)
}

func TestCrossUserIsolation(t *testing.T) {
	s, q, uidA := newTestService(t)
	ctx := context.Background()
	uidB := makeUser(t, q, "b@example.com")

	mine, err := s.Create(ctx, uidA, validInput("A's Exercise"))
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	// B cannot see, edit, or delete A's exercise.
	_, err = s.Get(ctx, uidB, mine.ID)
	assertCode(t, err, apperr.CodeNotFound)
	_, err = s.Update(ctx, uidB, mine.ID, validInput("steal"))
	assertCode(t, err, apperr.CodeNotFound)
	err = s.Delete(ctx, uidB, mine.ID)
	assertCode(t, err, apperr.CodeNotFound)

	if list, _ := s.List(ctx, uidB); len(list) != 0 {
		t.Fatalf("B should not see A's exercises, got %d", len(list))
	}
}

func TestValidation(t *testing.T) {
	s, _, uid := newTestService(t)
	ctx := context.Background()

	_, err := s.Create(ctx, uid, Input{Name: "  ", ExerciseType: "weight_reps"})
	assertCode(t, err, apperr.CodeValidation)

	_, err = s.Create(ctx, uid, Input{Name: "Bad Type", ExerciseType: "nonsense"})
	assertCode(t, err, apperr.CodeValidation)
}
