package db

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"testing"

	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
)

// newTestDB opens a migrated temp SQLite and returns the DB + Queries.
func newTestDB(t *testing.T) (*sql.DB, *sqlc.Queries) {
	t.Helper()
	d, err := Open(filepath.Join(t.TempDir(), "tx.db"))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = d.Close() })
	if err := Migrate(d); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return d, sqlc.New(d)
}

func TestInTxCommitsOnSuccess(t *testing.T) {
	d, q := newTestDB(t)
	ctx := context.Background()

	err := InTx(ctx, d, q, func(qtx *sqlc.Queries) error {
		_, e := qtx.CreateUser(ctx, sqlc.CreateUserParams{
			ID: "u1", Email: "a@b.c", PasswordHash: "x", DisplayName: "A",
			Settings: "{}", CreatedAt: 1, UpdatedAt: 1,
		})
		return e
	})
	if err != nil {
		t.Fatalf("InTx returned error: %v", err)
	}

	n, err := q.CountUsers(ctx)
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 1 {
		t.Fatalf("expected 1 committed user, got %d", n)
	}
}

func TestInTxRollsBackOnError(t *testing.T) {
	d, q := newTestDB(t)
	ctx := context.Background()

	sentinel := errors.New("boom")
	err := InTx(ctx, d, q, func(qtx *sqlc.Queries) error {
		if _, e := qtx.CreateUser(ctx, sqlc.CreateUserParams{
			ID: "u1", Email: "a@b.c", PasswordHash: "x", DisplayName: "A",
			Settings: "{}", CreatedAt: 1, UpdatedAt: 1,
		}); e != nil {
			return e
		}
		return sentinel // force a rollback after a successful insert
	})
	if !errors.Is(err, sentinel) {
		t.Fatalf("expected sentinel error, got %v", err)
	}

	n, err := q.CountUsers(ctx)
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 0 {
		t.Fatalf("expected 0 users after rollback, got %d", n)
	}
}
