package exercise

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
)

type builtin struct {
	Name      string
	Type      string
	Primary   string
	Secondary string // JSON array
	Equipment string
}

// builtinExercises is the starter library shipped with every instance.
var builtinExercises = []builtin{
	{"Barbell Bench Press", "weight_reps", "Chest", `["Triceps","Shoulders"]`, "Barbell"},
	{"Incline Barbell Bench Press", "weight_reps", "Chest", `["Shoulders","Triceps"]`, "Barbell"},
	{"Dumbbell Bench Press", "weight_reps", "Chest", `["Triceps","Shoulders"]`, "Dumbbell"},
	{"Push Up", "reps_only", "Chest", `["Triceps","Shoulders"]`, "Bodyweight"},
	{"Overhead Press", "weight_reps", "Shoulders", `["Triceps"]`, "Barbell"},
	{"Lateral Raise", "weight_reps", "Shoulders", `[]`, "Dumbbell"},
	{"Barbell Back Squat", "weight_reps", "Quadriceps", `["Glutes","Hamstrings"]`, "Barbell"},
	{"Leg Press", "weight_reps", "Quadriceps", `["Glutes"]`, "Machine"},
	{"Romanian Deadlift", "weight_reps", "Hamstrings", `["Glutes","Lower Back"]`, "Barbell"},
	{"Leg Curl", "weight_reps", "Hamstrings", `[]`, "Machine"},
	{"Conventional Deadlift", "weight_reps", "Back", `["Glutes","Hamstrings"]`, "Barbell"},
	{"Barbell Row", "weight_reps", "Back", `["Biceps"]`, "Barbell"},
	{"Lat Pulldown", "weight_reps", "Back", `["Biceps"]`, "Cable"},
	{"Pull Up", "reps_only", "Back", `["Biceps"]`, "Bodyweight"},
	{"Dumbbell Bicep Curl", "weight_reps", "Biceps", `[]`, "Dumbbell"},
	{"Triceps Pushdown", "weight_reps", "Triceps", `[]`, "Cable"},
	{"Dip", "reps_only", "Triceps", `["Chest","Shoulders"]`, "Bodyweight"},
	{"Plank", "duration", "Core", `[]`, "Bodyweight"},
}

// SeedBuiltins inserts the built-in library if the exercises table is empty.
// It returns the number of rows inserted (0 if already seeded). Idempotent.
func SeedBuiltins(ctx context.Context, q *sqlc.Queries, now func() time.Time) (int, error) {
	n, err := q.CountExercises(ctx)
	if err != nil {
		return 0, err
	}
	if n > 0 {
		return 0, nil
	}
	ts := now().UnixMilli()
	for _, b := range builtinExercises {
		sec := b.Secondary
		if sec == "" {
			sec = "[]"
		}
		if err := q.CreateBuiltinExercise(ctx, sqlc.CreateBuiltinExerciseParams{
			ID:               uuid.NewString(),
			Name:             b.Name,
			ExerciseType:     b.Type,
			PrimaryMuscle:    b.Primary,
			SecondaryMuscles: sec,
			Equipment:        b.Equipment,
			Instructions:     "",
			CreatedAt:        ts,
			UpdatedAt:        ts,
		}); err != nil {
			return 0, err
		}
	}
	return len(builtinExercises), nil
}
