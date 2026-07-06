package db

import (
	"context"
	"database/sql"

	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
)

// InTx runs fn inside a database transaction: it begins a tx, hands fn a
// tx-scoped *sqlc.Queries (q.WithTx), and commits on success. If fn returns an
// error the deferred Rollback undoes the tx. This is the single home for the
// transaction boilerplate the service packages share.
func InTx(ctx context.Context, database *sql.DB, q *sqlc.Queries, fn func(*sqlc.Queries) error) error {
	tx, err := database.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if err := fn(q.WithTx(tx)); err != nil {
		return err
	}
	return tx.Commit()
}
