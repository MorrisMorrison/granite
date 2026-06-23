// Command granite starts the Granite HTTP API server.
package main

import (
	"context"
	"errors"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/MorrisMorrison/granite/apps/api/internal/auth"
	"github.com/MorrisMorrison/granite/apps/api/internal/config"
	"github.com/MorrisMorrison/granite/apps/api/internal/db"
	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
	"github.com/MorrisMorrison/granite/apps/api/internal/demoseed"
	"github.com/MorrisMorrison/granite/apps/api/internal/exercise"
	"github.com/MorrisMorrison/granite/apps/api/internal/logging"
	"github.com/MorrisMorrison/granite/apps/api/internal/routine"
	"github.com/MorrisMorrison/granite/apps/api/internal/server"
	syncpkg "github.com/MorrisMorrison/granite/apps/api/internal/sync"
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

	// Dev convenience: populate the demo account so it's there without running
	// seed-demo by hand. Never in prod (the default).
	if cfg.IsDev() {
		if created, err := demoseed.Seed(database); err != nil {
			log.Fatalf("seed demo data: %v", err)
		} else if created {
			slog.Info("seeded demo account (dev)", "email", demoseed.Email)
		}
	}

	tokens := auth.NewTokenManager(cfg.JWTSecret)
	authSvc := auth.NewService(queries, tokens, cfg.AllowRegistration)
	exerciseSvc := exercise.NewService(queries)
	routineSvc := routine.NewService(database, queries)
	workoutSvc := workout.NewService(database, queries)
	syncSvc := syncpkg.NewService(database, queries)
	srv := server.New(authSvc, exerciseSvc, routineSvc, workoutSvc, syncSvc, tokens, database, []string{cfg.BaseURL})

	httpSrv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second, // mitigates slow-header (Slowloris) clients
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      120 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	// Catch SIGINT/SIGTERM; once one arrives we stop catching so a second signal
	// (or an impatient orchestrator) can still force-quit.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		slog.Info("granite api listening", "addr", httpSrv.Addr)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server: %v", err)
		}
	}()

	<-ctx.Done()
	stop()
	slog.Info("shutting down, draining in-flight requests")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(shutdownCtx); err != nil {
		slog.Error("graceful shutdown timed out", "err", err)
	}
	// The deferred database.Close() runs next, flushing SQLite cleanly.
	slog.Info("stopped")
}
