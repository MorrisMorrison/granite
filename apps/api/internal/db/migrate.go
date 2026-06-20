package db

import (
	"database/sql"
	"fmt"

	"github.com/pressly/goose/v3"

	"github.com/MorrisMorrison/granite/apps/api/internal/db/migrations"
)

// Migrate applies all pending migrations from the embedded migration files.
func Migrate(d *sql.DB) error {
	goose.SetBaseFS(migrations.FS)
	defer goose.SetBaseFS(nil)

	if err := goose.SetDialect("sqlite3"); err != nil {
		return fmt.Errorf("set dialect: %w", err)
	}
	if err := goose.Up(d, "."); err != nil {
		return fmt.Errorf("apply migrations: %w", err)
	}
	return nil
}
