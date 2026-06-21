// Command seed-demo creates a demo account (demo@granite.local / demodata) populated
// with routines and a few weeks of workout history — for local development and demos.
// It's idempotent: if the demo user already exists it does nothing.
//
//	GRANITE_DB_PATH   SQLite file to seed (default: granite.db)
package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/MorrisMorrison/granite/apps/api/internal/auth"
	"github.com/MorrisMorrison/granite/apps/api/internal/db"
	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
	"github.com/MorrisMorrison/granite/apps/api/internal/exercise"
	"github.com/MorrisMorrison/granite/apps/api/internal/routine"
	"github.com/MorrisMorrison/granite/apps/api/internal/workout"
)

const (
	demoEmail = "demo@granite.local"
	demoPass  = "demodata"
	demoName  = "Demo"
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

	created, err := seed(database)
	if err != nil {
		log.Fatalf("seed: %v", err)
	}
	if created {
		fmt.Printf("Seeded demo account in %s\n  email:    %s\n  password: %s\n", dbPath, demoEmail, demoPass)
	} else {
		fmt.Printf("Demo account already present in %s — nothing to do.\n", dbPath)
	}
}

// seed migrates, seeds built-ins, and creates the demo user + data if absent.
// Returns created=false when the demo user already exists.
func seed(database *sql.DB) (bool, error) {
	ctx := context.Background()
	if err := db.Migrate(database); err != nil {
		return false, fmt.Errorf("migrate: %w", err)
	}
	q := sqlc.New(database)
	if _, err := exercise.SeedBuiltins(ctx, q, time.Now); err != nil {
		return false, fmt.Errorf("seed built-ins: %w", err)
	}

	if _, err := q.GetUserByEmail(ctx, demoEmail); err == nil {
		return false, nil // already seeded
	} else if !errors.Is(err, sql.ErrNoRows) {
		return false, err
	}

	// JWT secret is irrelevant here (we never use the returned tokens); registration
	// is allowed so we can create the account directly.
	authSvc := auth.NewService(q, auth.NewTokenManager(strings.Repeat("x", 32)), true)
	user, _, err := authSvc.Register(ctx, demoEmail, demoPass, demoName)
	if err != nil {
		return false, fmt.Errorf("register demo user: %w", err)
	}

	exSvc := exercise.NewService(q)
	rtSvc := routine.NewService(database, q)
	woSvc := workout.NewService(database, q)

	all, err := exSvc.List(ctx, user.ID)
	if err != nil {
		return false, err
	}
	byName := make(map[string]string, len(all))
	for _, e := range all {
		byName[e.Name] = e.ID
	}
	ex := func(name string) string {
		id := byName[name]
		if id == "" {
			log.Fatalf("built-in exercise %q not found — update the demo seed", name)
		}
		return id
	}

	folder, err := rtSvc.CreateFolder(ctx, user.ID, routine.FolderInput{Name: "Push / Pull / Legs"})
	if err != nil {
		return false, err
	}
	fid := folder.ID

	rset := func(weight float64, reps int) routine.SetInput {
		w, r := weight, reps
		return routine.SetInput{SetType: "normal", TargetWeight: &w, TargetReps: &r}
	}
	rex := func(name string, rest int, sets ...routine.SetInput) routine.ExerciseInput {
		return routine.ExerciseInput{ExerciseID: ex(name), RestSeconds: rest, Sets: sets}
	}
	mkRoutine := func(title string, exs ...routine.ExerciseInput) {
		if _, err := rtSvc.Create(ctx, user.ID, routine.RoutineInput{Title: title, FolderID: &fid, Exercises: exs}); err != nil {
			log.Fatalf("create routine %q: %v", title, err)
		}
	}
	mkRoutine("Push",
		rex("Barbell Bench Press", 180, rset(65, 5), rset(65, 5), rset(65, 5)),
		rex("Overhead Press", 120, rset(37.5, 8), rset(37.5, 8)),
		rex("Triceps Pushdown", 90, rset(27.5, 12), rset(27.5, 12)))
	mkRoutine("Pull",
		rex("Conventional Deadlift", 210, rset(110, 5), rset(110, 5)),
		rex("Barbell Row", 120, rset(60, 8), rset(60, 8)),
		rex("Pull Up", 120, rset(0, 8), rset(0, 8)))
	mkRoutine("Legs",
		rex("Barbell Back Squat", 210, rset(90, 5), rset(90, 5), rset(90, 5)),
		rex("Romanian Deadlift", 150, rset(80, 8), rset(80, 8)),
		rex("Leg Press", 120, rset(150, 12), rset(150, 12)))

	// History: 3 cycles of Push/Pull/Legs over ~6 weeks, progressing each cycle so
	// the per-exercise charts trend up and PRs land on the latest sessions.
	wset := func(weight float64, reps int) workout.WorkoutSetInput {
		w, r := weight, reps
		return workout.WorkoutSetInput{SetType: "normal", Weight: &w, Reps: &r, IsCompleted: true}
	}
	wex := func(name string, sets ...workout.WorkoutSetInput) workout.WorkoutExerciseInput {
		return workout.WorkoutExerciseInput{ExerciseID: ex(name), Sets: sets}
	}
	logSession := func(title string, daysAgo int, exs ...workout.WorkoutExerciseInput) {
		start := time.Now().AddDate(0, 0, -daysAgo).UnixMilli()
		end := start + int64(60*60*1000)
		if _, err := woSvc.Create(ctx, user.ID, workout.WorkoutInput{Title: title, StartTime: start, EndTime: &end, Exercises: exs}); err != nil {
			log.Fatalf("log session %q: %v", title, err)
		}
	}

	for cycle := 0; cycle < 3; cycle++ {
		d := 42 - cycle*14 // ~6, 4, 2 weeks ago (older → newer)
		bench := 60.0 + float64(cycle)*2.5
		squat := 80.0 + float64(cycle)*5
		dead := 100.0 + float64(cycle)*5
		logSession("Push", d,
			wex("Barbell Bench Press", wset(bench, 5), wset(bench, 5), wset(bench, 5)),
			wex("Overhead Press", wset(35+float64(cycle)*2.5, 8), wset(35+float64(cycle)*2.5, 8)),
			wex("Triceps Pushdown", wset(25+float64(cycle)*2.5, 12), wset(25+float64(cycle)*2.5, 12)))
		logSession("Pull", d-2,
			wex("Conventional Deadlift", wset(dead, 5), wset(dead, 5)),
			wex("Barbell Row", wset(55+float64(cycle)*2.5, 8), wset(55+float64(cycle)*2.5, 8)),
			wex("Pull Up", wset(0, 8), wset(0, 7)))
		logSession("Legs", d-4,
			wex("Barbell Back Squat", wset(squat, 5), wset(squat, 5), wset(squat, 5)),
			wex("Romanian Deadlift", wset(70+float64(cycle)*5, 8), wset(70+float64(cycle)*5, 8)),
			wex("Leg Press", wset(140+float64(cycle)*10, 12), wset(140+float64(cycle)*10, 12)))
	}

	return true, nil
}
