// Package demoseed creates a demo account (demo@granite.local / demodata) with
// routines and a few weeks of workout history — for local development and demos.
// It's idempotent: if the demo user already exists it does nothing. Used by the
// seed-demo command and by the server when GRANITE_ENV=dev.
package demoseed

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/MorrisMorrison/granite/apps/api/internal/auth"
	"github.com/MorrisMorrison/granite/apps/api/internal/db"
	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
	"github.com/MorrisMorrison/granite/apps/api/internal/exercise"
	"github.com/MorrisMorrison/granite/apps/api/internal/routine"
	"github.com/MorrisMorrison/granite/apps/api/internal/workout"
)

// Demo account credentials.
const (
	Email    = "demo@granite.local"
	Password = "demodata"
	Name     = "Demo"
)

// Seed migrates, seeds built-ins, and creates the demo user + data if absent.
// Returns created=false when the demo user already exists.
func Seed(database *sql.DB) (bool, error) {
	ctx := context.Background()
	if err := db.Migrate(database); err != nil {
		return false, fmt.Errorf("migrate: %w", err)
	}
	q := sqlc.New(database)
	if _, err := exercise.SeedBuiltins(ctx, q, time.Now); err != nil {
		return false, fmt.Errorf("seed built-ins: %w", err)
	}

	if _, err := q.GetUserByEmail(ctx, Email); err == nil {
		return false, nil // already seeded
	} else if !errors.Is(err, sql.ErrNoRows) {
		return false, err
	}

	// JWT secret is irrelevant here (we never use the returned tokens); registration
	// is allowed so we can create the account directly.
	authSvc := auth.NewService(q, auth.NewTokenManager(strings.Repeat("x", 32)), true)
	user, _, err := authSvc.Register(ctx, Email, Password, Name)
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

	// Two folders + an ungrouped routine, to showcase folder grouping.
	mkFolder := func(name string) *string {
		f, err := rtSvc.CreateFolder(ctx, user.ID, routine.FolderInput{Name: name})
		if err != nil {
			log.Fatalf("create folder %q: %v", name, err)
		}
		id := f.ID
		return &id
	}
	ppl := mkFolder("Push / Pull / Legs")
	bodyweight := mkFolder("Bodyweight")

	rset := func(weight float64, reps int) routine.SetInput {
		w, r := weight, reps
		return routine.SetInput{SetType: "normal", TargetWeight: &w, TargetReps: &r}
	}
	rex := func(name string, rest int, sets ...routine.SetInput) routine.ExerciseInput {
		return routine.ExerciseInput{ExerciseID: ex(name), RestSeconds: rest, Sets: sets}
	}
	mkRoutine := func(title string, folderID *string, exs ...routine.ExerciseInput) {
		if _, err := rtSvc.Create(ctx, user.ID, routine.RoutineInput{Title: title, FolderID: folderID, Exercises: exs}); err != nil {
			log.Fatalf("create routine %q: %v", title, err)
		}
	}
	mkRoutine("Push", ppl,
		rex("Barbell Bench Press", 180, rset(65, 5), rset(65, 5), rset(65, 5)),
		rex("Overhead Press", 120, rset(37.5, 8), rset(37.5, 8)),
		rex("Triceps Pushdown", 90, rset(27.5, 12), rset(27.5, 12)))
	mkRoutine("Pull", ppl,
		rex("Conventional Deadlift", 210, rset(110, 5), rset(110, 5)),
		rex("Barbell Row", 120, rset(60, 8), rset(60, 8)),
		rex("Pull Up", 120, rset(0, 8), rset(0, 8)))
	mkRoutine("Legs", ppl,
		rex("Barbell Back Squat", 210, rset(90, 5), rset(90, 5), rset(90, 5)),
		rex("Romanian Deadlift", 150, rset(80, 8), rset(80, 8)),
		rex("Leg Press", 120, rset(150, 12), rset(150, 12)))
	mkRoutine("Calisthenics", bodyweight,
		rex("Pull Up", 120, rset(0, 8), rset(0, 8), rset(0, 6)),
		rex("Dip", 120, rset(0, 10), rset(0, 8)),
		rex("Push Up", 90, rset(0, 15), rset(0, 15)))
	mkRoutine("Full Body (quick)", nil, // ungrouped — shows the "Ungrouped" section
		rex("Barbell Back Squat", 180, rset(80, 5), rset(80, 5)),
		rex("Barbell Bench Press", 180, rset(60, 5), rset(60, 5)),
		rex("Barbell Row", 120, rset(55, 8), rset(55, 8)))

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
