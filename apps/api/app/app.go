// Package app is the public embedding entrypoint for the Granite server. It wires
// configuration, database, services, and the HTTP server so an external program
// can run Granite with a custom AccountGate (see package gate) without importing
// internal packages or duplicating the bootstrap.
package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/MorrisMorrison/granite/apps/api/gate"
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

// Options configures Run.
type Options struct {
	// Gate authorizes account creation and sync. nil → gate.AllowAll{}.
	Gate gate.AccountGate
}

func (o Options) gateOrDefault() gate.AccountGate {
	if o.Gate == nil {
		return gate.AllowAll{}
	}
	return o.Gate
}

// Run loads configuration, opens and migrates the database, seeds built-ins, and
// serves the HTTP API until ctx is cancelled or a termination signal arrives.
func Run(ctx context.Context, opts Options) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("config: %w", err)
	}
	slog.SetDefault(logging.New(cfg.LogLevel))

	database, err := db.Open(cfg.DBPath)
	if err != nil {
		return fmt.Errorf("db open: %w", err)
	}
	defer func() { _ = database.Close() }()
	if err := db.Migrate(database); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}

	queries := sqlc.New(database)
	if n, err := exercise.SeedBuiltins(ctx, queries, time.Now); err != nil {
		return fmt.Errorf("seed built-in exercises: %w", err)
	} else if n > 0 {
		slog.Info("seeded built-in exercises", "count", n)
	}

	// Dev convenience: populate the demo account. Never in prod (the default).
	if cfg.IsDev() {
		if created, err := demoseed.Seed(database); err != nil {
			return fmt.Errorf("seed demo data: %w", err)
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
	srv := server.New(authSvc, exerciseSvc, routineSvc, workoutSvc, syncSvc, tokens, database, []string{cfg.BaseURL}, server.WithGate(opts.gateOrDefault()), server.WithTrustedProxy(cfg.TrustedProxy))

	httpSrv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second, // mitigates slow-header (Slowloris) clients
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      120 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	// Catch SIGINT/SIGTERM; once one arrives we stop catching so a second signal
	// can still force-quit.
	sigCtx, stop := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
	defer stop()

	errCh := make(chan error, 1)
	go func() {
		slog.Info("granite api listening", "addr", httpSrv.Addr)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return fmt.Errorf("server: %w", err)
	case <-sigCtx.Done():
	}
	stop()
	slog.Info("shutting down, draining in-flight requests")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(shutdownCtx); err != nil {
		slog.Error("graceful shutdown timed out", "err", err)
	}
	// The deferred database.Close() runs next, flushing SQLite cleanly.
	slog.Info("stopped")
	return nil
}
