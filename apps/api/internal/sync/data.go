package sync

import (
	"context"
	"database/sql"
	"encoding/json"
)

// --- wire DTOs (Change.Data shapes) -----------------------------------------

type exerciseData struct {
	Name             string          `json:"name"`
	ExerciseType     string          `json:"exercise_type"`
	PrimaryMuscle    string          `json:"primary_muscle"`
	SecondaryMuscles json.RawMessage `json:"secondary_muscles"`
	Equipment        string          `json:"equipment"`
	Instructions     string          `json:"instructions"`
	IsArchived       bool            `json:"is_archived"`
	CreatedAt        int64           `json:"created_at"`
}

type folderData struct {
	Name       string `json:"name"`
	OrderIndex int64  `json:"order_index"`
	CreatedAt  int64  `json:"created_at"`
}

type routineSetData struct {
	ID             string   `json:"id"`
	OrderIndex     int64    `json:"order_index"`
	SetType        string   `json:"set_type"`
	TargetWeight   *float64 `json:"target_weight"`
	TargetReps     *int64   `json:"target_reps"`
	TargetRpe      *float64 `json:"target_rpe"`
	TargetDuration *int64   `json:"target_duration"`
}

type routineExerciseData struct {
	ID            string           `json:"id"`
	ExerciseID    string           `json:"exercise_id"`
	OrderIndex    int64            `json:"order_index"`
	Notes         string           `json:"notes"`
	RestSeconds   int64            `json:"rest_seconds"`
	SupersetGroup *int64           `json:"superset_group"`
	Sets          []routineSetData `json:"sets"`
}

type routineData struct {
	FolderID   *string               `json:"folder_id"`
	Title      string                `json:"title"`
	Notes      string                `json:"notes"`
	OrderIndex int64                 `json:"order_index"`
	CreatedAt  int64                 `json:"created_at"`
	Exercises  []routineExerciseData `json:"exercises"`
}

type workoutSetData struct {
	ID          string   `json:"id"`
	OrderIndex  int64    `json:"order_index"`
	SetType     string   `json:"set_type"`
	Weight      *float64 `json:"weight"`
	Reps        *int64   `json:"reps"`
	Rpe         *float64 `json:"rpe"`
	Duration    *int64   `json:"duration"`
	Distance    *float64 `json:"distance"`
	IsCompleted bool     `json:"is_completed"`
}

type workoutExerciseData struct {
	ID            string           `json:"id"`
	ExerciseID    string           `json:"exercise_id"`
	OrderIndex    int64            `json:"order_index"`
	Notes         string           `json:"notes"`
	SupersetGroup *int64           `json:"superset_group"`
	Sets          []workoutSetData `json:"sets"`
}

type workoutData struct {
	RoutineID *string               `json:"routine_id"`
	Title     string                `json:"title"`
	Notes     string                `json:"notes"`
	StartTime int64                 `json:"start_time"`
	EndTime   *int64                `json:"end_time"`
	CreatedAt int64                 `json:"created_at"`
	Exercises []workoutExerciseData `json:"exercises"`
}

type bodyweightData struct {
	Weight     float64 `json:"weight"`
	RecordedAt int64   `json:"recorded_at"`
	CreatedAt  int64   `json:"created_at"`
}

// --- child loading (for pull) -----------------------------------------------

func (s *Service) loadRoutineChildren(ctx context.Context, routineID string) ([]routineExerciseData, error) {
	exs, err := s.q.ListRoutineExercises(ctx, routineID)
	if err != nil {
		return nil, err
	}
	sets, err := s.q.ListRoutineSetsForRoutine(ctx, routineID)
	if err != nil {
		return nil, err
	}
	byRE := map[string][]routineSetData{}
	for _, st := range sets {
		byRE[st.RoutineExerciseID] = append(byRE[st.RoutineExerciseID], routineSetData{
			ID: st.ID, OrderIndex: st.OrderIndex, SetType: st.SetType,
			TargetWeight: f64Ptr(st.TargetWeight), TargetReps: i64Ptr(st.TargetReps),
			TargetRpe: f64Ptr(st.TargetRpe), TargetDuration: i64Ptr(st.TargetDuration),
		})
	}
	out := []routineExerciseData{}
	for _, e := range exs {
		ss := byRE[e.ID]
		if ss == nil {
			ss = []routineSetData{}
		}
		out = append(out, routineExerciseData{
			ID: e.ID, ExerciseID: e.ExerciseID, OrderIndex: e.OrderIndex, Notes: e.Notes,
			RestSeconds: e.RestSeconds, SupersetGroup: i64Ptr(e.SupersetGroup), Sets: ss,
		})
	}
	return out, nil
}

func (s *Service) loadWorkoutChildren(ctx context.Context, workoutID string) ([]workoutExerciseData, error) {
	exs, err := s.q.ListWorkoutExercises(ctx, workoutID)
	if err != nil {
		return nil, err
	}
	sets, err := s.q.ListWorkoutSetsForWorkout(ctx, workoutID)
	if err != nil {
		return nil, err
	}
	byWE := map[string][]workoutSetData{}
	for _, st := range sets {
		byWE[st.WorkoutExerciseID] = append(byWE[st.WorkoutExerciseID], workoutSetData{
			ID: st.ID, OrderIndex: st.OrderIndex, SetType: st.SetType,
			Weight: f64Ptr(st.Weight), Reps: i64Ptr(st.Reps), Rpe: f64Ptr(st.Rpe),
			Duration: i64Ptr(st.Duration), Distance: f64Ptr(st.Distance), IsCompleted: st.IsCompleted != 0,
		})
	}
	out := []workoutExerciseData{}
	for _, e := range exs {
		ss := byWE[e.ID]
		if ss == nil {
			ss = []workoutSetData{}
		}
		out = append(out, workoutExerciseData{
			ID: e.ID, ExerciseID: e.ExerciseID, OrderIndex: e.OrderIndex, Notes: e.Notes,
			SupersetGroup: i64Ptr(e.SupersetGroup), Sets: ss,
		})
	}
	return out, nil
}

// --- helpers ----------------------------------------------------------------

func mustJSON(v any) json.RawMessage {
	b, _ := json.Marshal(v)
	return b
}

func orDefault(s, def string) string {
	if s == "" {
		return def
	}
	return s
}

func b2i(b bool) int64 {
	if b {
		return 1
	}
	return 0
}

func strPtr(n sql.NullString) *string {
	if !n.Valid {
		return nil
	}
	v := n.String
	return &v
}
func nullStr(p *string) sql.NullString {
	if p == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: *p, Valid: true}
}
func i64Ptr(n sql.NullInt64) *int64 {
	if !n.Valid {
		return nil
	}
	v := n.Int64
	return &v
}
func nullI64(p *int64) sql.NullInt64 {
	if p == nil {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: *p, Valid: true}
}
func f64Ptr(n sql.NullFloat64) *float64 {
	if !n.Valid {
		return nil
	}
	v := n.Float64
	return &v
}
func nullF64(p *float64) sql.NullFloat64 {
	if p == nil {
		return sql.NullFloat64{}
	}
	return sql.NullFloat64{Float64: *p, Valid: true}
}
