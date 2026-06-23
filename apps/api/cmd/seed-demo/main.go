// Command seed-demo creates a demo account (demo@granite.local / demodata) populated
// with routines and a few weeks of workout history — for local development and demos.
// It's idempotent: if the demo user already exists it does nothing. (The server
// does this automatically when GRANITE_ENV=dev.)
//
//	GRANITE_DB_PATH   SQLite file to seed (default: granite.db)
package main

import (
	"fmt"
	"log"
	"os"

	"github.com/MorrisMorrison/granite/apps/api/internal/db"
	"github.com/MorrisMorrison/granite/apps/api/internal/demoseed"
)

func main() {
	dbPath := os.Getenv("GRANITE_DB_PATH")
	if dbPath == "" {
		dbPath = "granite.db"
	}
	database, err := db.Open(dbPath)
	if err != nil {
		log.Fatalf("db open: %v", err)
	}
	defer func() { _ = database.Close() }()

	created, err := demoseed.Seed(database)
	if err != nil {
		log.Fatalf("seed: %v", err)
	}
	if created {
		fmt.Printf("Seeded demo account in %s\n  email:    %s\n  password: %s\n", dbPath, demoseed.Email, demoseed.Password)
	} else {
		fmt.Printf("Demo account already present in %s — nothing to do.\n", dbPath)
	}
}
