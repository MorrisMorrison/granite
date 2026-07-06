package sync

import (
	"context"
	"database/sql"
	"encoding/json"
	"path/filepath"
	"testing"

	"github.com/google/uuid"

	"github.com/MorrisMorrison/granite/apps/api/internal/db"
	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
)

// newTestService builds a sync Service over a real temp SQLite (migrated), plus a
// user and one user-owned exercise to hang routines/workouts off of. Mirrors the
// routine package's harness.
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

// makeBuiltinExercise inserts a built-in exercise (user_id NULL) — read-only per
// the sync guard / ADR-0008.
func makeBuiltinExercise(t *testing.T, q *sqlc.Queries, name string) string {
	t.Helper()
	id := uuid.NewString()
	if _, err := q.CreateExercise(context.Background(), sqlc.CreateExerciseParams{
		ID: id, UserID: sql.NullString{}, Name: name,
		ExerciseType: "weight_reps", SecondaryMuscles: "[]", CreatedAt: 0, UpdatedAt: 0,
	}); err != nil {
		t.Fatalf("create builtin exercise: %v", err)
	}
	return id
}

// --- change builders --------------------------------------------------------

func mkChange(entity, id string, updatedAt int64, deleted bool, data any) Change {
	return Change{Entity: entity, ID: id, UpdatedAt: updatedAt, Deleted: deleted, Data: mustJSON(data)}
}

// push is a thin wrapper that fails the test on error and returns applied ids.
func mustPush(t *testing.T, s *Service, uid string, changes ...Change) []string {
	t.Helper()
	applied, err := s.Push(context.Background(), uid, changes)
	if err != nil {
		t.Fatalf("push: %v", err)
	}
	return applied
}

// mustPull fails on error and returns the changes + cursor.
func mustPull(t *testing.T, s *Service, uid string, since int64) ([]Change, int64) {
	t.Helper()
	changes, cursor, err := s.Pull(context.Background(), uid, since)
	if err != nil {
		t.Fatalf("pull: %v", err)
	}
	return changes, cursor
}

func findChange(cs []Change, id string) *Change {
	for i := range cs {
		if cs[i].ID == id {
			return &cs[i]
		}
	}
	return nil
}

// decode unmarshals a change's Data into dst.
func decode(t *testing.T, c *Change, dst any) {
	t.Helper()
	if c == nil {
		t.Fatal("change not found")
	}
	if err := json.Unmarshal(c.Data, dst); err != nil {
		t.Fatalf("decode data: %v", err)
	}
}
