package exercise

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
)

// builtinNamespace is a fixed UUID namespace used to derive deterministic
// UUIDv5 ids for built-in exercises (from the namespace + the exercise name).
// This makes built-in ids identical across every instance, so a routine/workout
// exported from one instance keeps working when imported into a fresh one.
// Never change this value: it would re-id every future install's built-ins.
var builtinNamespace = uuid.MustParse("6b1f0c3e-3d2a-5e4b-8f7c-0a1b2c3d4e5f")

// builtinID returns the deterministic id for a built-in exercise given its name.
func builtinID(name string) string {
	return uuid.NewSHA1(builtinNamespace, []byte(name)).String()
}

type builtin struct {
	Name      string
	Type      string
	Primary   string
	Secondary string // JSON array
	Equipment string
}

// builtinExercises is the starter library shipped with every instance.
var builtinExercises = []builtin{
	// --- Chest ---
	{"Barbell Bench Press", "weight_reps", "Chest", `["Triceps","Shoulders"]`, "Barbell"},
	{"Incline Barbell Bench Press", "weight_reps", "Chest", `["Shoulders","Triceps"]`, "Barbell"},
	{"Decline Barbell Bench Press", "weight_reps", "Chest", `["Triceps"]`, "Barbell"},
	{"Dumbbell Bench Press", "weight_reps", "Chest", `["Triceps","Shoulders"]`, "Dumbbell"},
	{"Incline Dumbbell Bench Press", "weight_reps", "Chest", `["Shoulders","Triceps"]`, "Dumbbell"},
	{"Machine Chest Press", "weight_reps", "Chest", `["Triceps","Shoulders"]`, "Machine"},
	{"Cable Fly", "weight_reps", "Chest", `[]`, "Cable"},
	{"Dumbbell Fly", "weight_reps", "Chest", `[]`, "Dumbbell"},
	{"Pec Deck", "weight_reps", "Chest", `[]`, "Machine"},
	{"Push Up", "reps_only", "Chest", `["Triceps","Shoulders"]`, "Bodyweight"},

	// --- Back ---
	{"Conventional Deadlift", "weight_reps", "Back", `["Glutes","Hamstrings"]`, "Barbell"},
	{"Sumo Deadlift", "weight_reps", "Back", `["Glutes","Hamstrings"]`, "Barbell"},
	{"Trap Bar Deadlift", "weight_reps", "Back", `["Glutes","Quadriceps"]`, "Barbell"},
	{"Barbell Row", "weight_reps", "Back", `["Biceps"]`, "Barbell"},
	{"Pendlay Row", "weight_reps", "Back", `["Biceps"]`, "Barbell"},
	{"T-Bar Row", "weight_reps", "Back", `["Biceps"]`, "Barbell"},
	{"Dumbbell Row", "weight_reps", "Back", `["Biceps"]`, "Dumbbell"},
	{"Seated Cable Row", "weight_reps", "Back", `["Biceps"]`, "Cable"},
	{"Chest-Supported Row", "weight_reps", "Back", `["Biceps"]`, "Machine"},
	{"Lat Pulldown", "weight_reps", "Back", `["Biceps"]`, "Cable"},
	{"Close-Grip Lat Pulldown", "weight_reps", "Back", `["Biceps"]`, "Cable"},
	{"Straight-Arm Pulldown", "weight_reps", "Back", `[]`, "Cable"},
	{"Pull Up", "reps_only", "Back", `["Biceps"]`, "Bodyweight"},
	{"Chin Up", "reps_only", "Back", `["Biceps"]`, "Bodyweight"},
	{"Back Extension", "reps_only", "Lower Back", `["Glutes","Hamstrings"]`, "Bodyweight"},
	{"Barbell Shrug", "weight_reps", "Traps", `[]`, "Barbell"},
	{"Dumbbell Shrug", "weight_reps", "Traps", `[]`, "Dumbbell"},

	// --- Legs ---
	{"Barbell Back Squat", "weight_reps", "Quadriceps", `["Glutes","Hamstrings"]`, "Barbell"},
	{"Front Squat", "weight_reps", "Quadriceps", `["Glutes"]`, "Barbell"},
	{"Hack Squat", "weight_reps", "Quadriceps", `["Glutes"]`, "Machine"},
	{"Goblet Squat", "weight_reps", "Quadriceps", `["Glutes"]`, "Dumbbell"},
	{"Bulgarian Split Squat", "weight_reps", "Quadriceps", `["Glutes"]`, "Dumbbell"},
	{"Walking Lunge", "weight_reps", "Quadriceps", `["Glutes"]`, "Dumbbell"},
	{"Leg Press", "weight_reps", "Quadriceps", `["Glutes"]`, "Machine"},
	{"Leg Extension", "weight_reps", "Quadriceps", `[]`, "Machine"},
	{"Romanian Deadlift", "weight_reps", "Hamstrings", `["Glutes","Lower Back"]`, "Barbell"},
	{"Good Morning", "weight_reps", "Hamstrings", `["Glutes","Lower Back"]`, "Barbell"},
	{"Stiff-Leg Deadlift", "weight_reps", "Hamstrings", `["Glutes"]`, "Barbell"},
	{"Leg Curl", "weight_reps", "Hamstrings", `[]`, "Machine"},
	{"Seated Leg Curl", "weight_reps", "Hamstrings", `[]`, "Machine"},
	{"Hip Thrust", "weight_reps", "Glutes", `["Hamstrings"]`, "Barbell"},
	{"Glute Bridge", "weight_reps", "Glutes", `["Hamstrings"]`, "Barbell"},
	{"Hip Abduction", "weight_reps", "Glutes", `[]`, "Machine"},
	{"Hip Adduction", "weight_reps", "Adductors", `[]`, "Machine"},
	{"Standing Calf Raise", "weight_reps", "Calves", `[]`, "Machine"},
	{"Seated Calf Raise", "weight_reps", "Calves", `[]`, "Machine"},
	{"Kettlebell Swing", "weight_reps", "Glutes", `["Hamstrings","Back"]`, "Kettlebell"},

	// --- Shoulders ---
	{"Overhead Press", "weight_reps", "Shoulders", `["Triceps"]`, "Barbell"},
	{"Seated Dumbbell Shoulder Press", "weight_reps", "Shoulders", `["Triceps"]`, "Dumbbell"},
	{"Arnold Press", "weight_reps", "Shoulders", `["Triceps"]`, "Dumbbell"},
	{"Machine Shoulder Press", "weight_reps", "Shoulders", `["Triceps"]`, "Machine"},
	{"Lateral Raise", "weight_reps", "Shoulders", `[]`, "Dumbbell"},
	{"Cable Lateral Raise", "weight_reps", "Shoulders", `[]`, "Cable"},
	{"Front Raise", "weight_reps", "Shoulders", `[]`, "Dumbbell"},
	{"Rear Delt Fly", "weight_reps", "Shoulders", `["Back"]`, "Dumbbell"},
	{"Reverse Pec Deck", "weight_reps", "Shoulders", `["Back"]`, "Machine"},
	{"Face Pull", "weight_reps", "Shoulders", `["Back"]`, "Cable"},
	{"Upright Row", "weight_reps", "Shoulders", `["Traps"]`, "Barbell"},

	// --- Biceps ---
	{"Barbell Curl", "weight_reps", "Biceps", `[]`, "Barbell"},
	{"EZ-Bar Curl", "weight_reps", "Biceps", `[]`, "EZ Bar"},
	{"Dumbbell Bicep Curl", "weight_reps", "Biceps", `[]`, "Dumbbell"},
	{"Hammer Curl", "weight_reps", "Biceps", `["Forearms"]`, "Dumbbell"},
	{"Incline Dumbbell Curl", "weight_reps", "Biceps", `[]`, "Dumbbell"},
	{"Preacher Curl", "weight_reps", "Biceps", `[]`, "EZ Bar"},
	{"Concentration Curl", "weight_reps", "Biceps", `[]`, "Dumbbell"},
	{"Cable Curl", "weight_reps", "Biceps", `[]`, "Cable"},

	// --- Triceps ---
	{"Close-Grip Bench Press", "weight_reps", "Triceps", `["Chest"]`, "Barbell"},
	{"Skullcrusher", "weight_reps", "Triceps", `[]`, "EZ Bar"},
	{"Overhead Triceps Extension", "weight_reps", "Triceps", `[]`, "Dumbbell"},
	{"Triceps Pushdown", "weight_reps", "Triceps", `[]`, "Cable"},
	{"Rope Pushdown", "weight_reps", "Triceps", `[]`, "Cable"},
	{"Triceps Kickback", "weight_reps", "Triceps", `[]`, "Dumbbell"},
	{"Dip", "reps_only", "Triceps", `["Chest","Shoulders"]`, "Bodyweight"},
	{"Bench Dip", "reps_only", "Triceps", `[]`, "Bodyweight"},

	// --- Core ---
	{"Plank", "duration", "Core", `[]`, "Bodyweight"},
	{"Hanging Leg Raise", "reps_only", "Core", `[]`, "Bodyweight"},
	{"Cable Crunch", "weight_reps", "Core", `[]`, "Cable"},
	{"Crunch", "reps_only", "Core", `[]`, "Bodyweight"},
	{"Sit Up", "reps_only", "Core", `[]`, "Bodyweight"},
	{"Russian Twist", "reps_only", "Core", `[]`, "Bodyweight"},
	{"Ab Wheel Rollout", "reps_only", "Core", `[]`, "Bodyweight"},

	// --- Forearms / carries ---
	{"Wrist Curl", "weight_reps", "Forearms", `[]`, "Barbell"},
	{"Farmer's Carry", "duration", "Forearms", `["Traps","Core"]`, "Dumbbell"},
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
			ID:               builtinID(b.Name),
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
