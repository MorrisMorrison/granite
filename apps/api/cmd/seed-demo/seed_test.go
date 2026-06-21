package main

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/MorrisMorrison/granite/apps/api/internal/db"
	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
	"github.com/MorrisMorrison/granite/apps/api/internal/routine"
	"github.com/MorrisMorrison/granite/apps/api/internal/workout"
)

func TestSeedDemoIdempotent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "seed.db")
	database, err := db.Open(path)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer func() { _ = database.Close() }()
	ctx := context.Background()

	created, err := seed(database)
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	if !created {
		t.Fatal("first seed should create the demo account")
	}

	q := sqlc.New(database)
	u, err := q.GetUserByEmail(ctx, demoEmail)
	if err != nil {
		t.Fatalf("demo user not found after seed: %v", err)
	}

	rtSvc := routine.NewService(database, q)
	routines, err := rtSvc.ListFull(ctx, u.ID)
	if err != nil {
		t.Fatalf("list routines: %v", err)
	}
	if len(routines) != 5 {
		t.Fatalf("want 5 routines, got %d", len(routines))
	}
	folders, err := rtSvc.ListFolders(ctx, u.ID)
	if err != nil {
		t.Fatalf("list folders: %v", err)
	}
	if len(folders) != 2 {
		t.Fatalf("want 2 folders, got %d", len(folders))
	}

	woSvc := workout.NewService(database, q)
	workouts, err := woSvc.List(ctx, u.ID)
	if err != nil {
		t.Fatalf("list workouts: %v", err)
	}
	if len(workouts) != 9 {
		t.Fatalf("want 9 workouts, got %d", len(workouts))
	}

	// Re-seeding is a no-op (no duplicates).
	created2, err := seed(database)
	if err != nil {
		t.Fatalf("re-seed: %v", err)
	}
	if created2 {
		t.Fatal("second seed should not re-create the demo account")
	}
	workouts2, err := woSvc.List(ctx, u.ID)
	if err != nil {
		t.Fatalf("list workouts (2): %v", err)
	}
	if len(workouts2) != 9 {
		t.Fatalf("re-seed changed workout count: got %d, want 9", len(workouts2))
	}
}
