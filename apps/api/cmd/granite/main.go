// Command granite starts the Granite HTTP API server.
package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"time"

	"github.com/MorrisMorrison/granite/apps/api/internal/auth"
	"github.com/MorrisMorrison/granite/apps/api/internal/config"
	"github.com/MorrisMorrison/granite/apps/api/internal/db"
	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
	"github.com/MorrisMorrison/granite/apps/api/internal/exercise"
	"github.com/MorrisMorrison/granite/apps/api/internal/logging"
	"github.com/MorrisMorrison/granite/apps/api/internal/routine"
	"github.com/MorrisMorrison/granite/apps/api/internal/server"
	"github.com/MorrisMorrison/granite/apps/api/internal/workout"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	slog.SetDefault(logging.New(cfg.LogLevel))

	database, err := db.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("db open: %v", err)
	}
	defer func() { _ = database.Close() }()

	if err := db.Migrate(database); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	queries := sqlc.New(database)
	if n, err := exercise.SeedBuiltins(context.Background(), queries, time.Now); err != nil {
		log.Fatalf("seed built-in exercises: %v", err)
	} else if n > 0 {
		slog.Info("seeded built-in exercises", "count", n)
	}

	tokens := auth.NewTokenManager(cfg.JWTSecret)
	authSvc := auth.NewService(queries, tokens, cfg.AllowRegistration)
	exerciseSvc := exercise.NewService(queries)
	routineSvc := routine.NewService(database, queries)
	workoutSvc := workout.NewService(database, queries)
	srv := server.New(authSvc, exerciseSvc, routineSvc, workoutSvc, tokens, database, []string{cfg.BaseURL})

	addr := ":" + cfg.Port
	slog.Info("granite api listening", "addr", addr)
	if err := http.ListenAndServe(addr, srv.Handler()); err != nil {
		log.Fatalf("server: %v", err)
	}
}
