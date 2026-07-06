// Package workout provides logged-workout use-cases (nested workout → exercises → sets).
package workout

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/MorrisMorrison/granite/apps/api/internal/apperr"
	"github.com/MorrisMorrison/granite/apps/api/internal/db"
	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
	"github.com/MorrisMorrison/granite/apps/api/internal/sqlnull"
)

// Service implements logged-workout use-cases. Nested writes run in a tx.
type Service struct {
	db  *sql.DB
	q   *sqlc.Queries
	now func() time.Time
}

// NewService constructs a workout Service.
func NewService(db *sql.DB, q *sqlc.Queries) *Service {
	return &Service{db: db, q: q, now: time.Now}
}

var validSetTypes = map[string]bool{"normal": true, "warmup": true, "drop": true, "failure": true}

// --- Domain types -----------------------------------------------------------

type WorkoutSet struct {
	ID          string   `json:"id"`
	OrderIndex  int      `json:"order_index"`
	SetType     string   `json:"set_type"`
	Weight      *float64 `json:"weight"`
	Reps        *int     `json:"reps"`
	RPE         *float64 `json:"rpe"`
	Duration    *int     `json:"duration"`
	Distance    *float64 `json:"distance"`
	IsCompleted bool     `json:"is_completed"`
}

type WorkoutExercise struct {
	ID            string       `json:"id"`
	ExerciseID    string       `json:"exercise_id"`
	OrderIndex    int          `json:"order_index"`
	Notes         string       `json:"notes"`
	SupersetGroup *int         `json:"superset_group"`
	Sets          []WorkoutSet `json:"sets"`
}

type Workout struct {
	ID        string            `json:"id"`
	RoutineID *string           `json:"routine_id"`
	Title     string            `json:"title"`
	Notes     string            `json:"notes"`
	StartTime int64             `json:"start_time"`
	EndTime   *int64            `json:"end_time"`
	Exercises []WorkoutExercise `json:"exercises"`
	CreatedAt int64             `json:"created_at"`
	UpdatedAt int64             `json:"updated_at"`
}

// --- Inputs -----------------------------------------------------------------

type WorkoutSetInput struct {
	SetType     string   `json:"set_type,omitempty"`
	Weight      *float64 `json:"weight,omitempty" minimum:"0"`
	Reps        *int     `json:"reps,omitempty" minimum:"0"`
	RPE         *float64 `json:"rpe,omitempty" minimum:"0" maximum:"10"`
	Duration    *int     `json:"duration,omitempty" minimum:"0"`
	Distance    *float64 `json:"distance,omitempty" minimum:"0"`
	IsCompleted bool     `json:"is_completed,omitempty"`
}

type WorkoutExerciseInput struct {
	ExerciseID    string            `json:"exercise_id"`
	Notes         string            `json:"notes,omitempty"`
	SupersetGroup *int              `json:"superset_group,omitempty"`
	Sets          []WorkoutSetInput `json:"sets,omitempty"`
}

type WorkoutInput struct {
	RoutineID *string                `json:"routine_id,omitempty"`
	Title     string                 `json:"title,omitempty"`
	Notes     string                 `json:"notes,omitempty"`
	StartTime int64                  `json:"start_time,omitempty"`
	EndTime   *int64                 `json:"end_time,omitempty"`
	Exercises []WorkoutExerciseInput `json:"exercises,omitempty"`
}

// --- Use-cases --------------------------------------------------------------

// List returns the user's workouts (metadata only; use Get for the nested form).
func (s *Service) List(ctx context.Context, userID string) ([]Workout, error) {
	rows, err := s.q.ListWorkouts(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]Workout, 0, len(rows))
	for _, r := range rows {
		out = append(out, meta(r))
	}
	return out, nil
}

// ListFull returns the user's workouts with all nested exercises and sets (used by export).
func (s *Service) ListFull(ctx context.Context, userID string) ([]Workout, error) {
	rows, err := s.q.ListWorkouts(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]Workout, 0, len(rows))
	for _, r := range rows {
		w, err := s.loadNested(ctx, r)
		if err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, nil
}

// Get returns a workout with its exercises and sets.
func (s *Service) Get(ctx context.Context, userID, id string) (Workout, error) {
	w, err := s.q.GetWorkout(ctx, id)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && w.UserID != userID) {
		return Workout{}, apperr.NotFound("workout not found")
	}
	if err != nil {
		return Workout{}, err
	}
	return s.loadNested(ctx, w)
}

// Create logs a workout with its exercises and sets in a transaction.
func (s *Service) Create(ctx context.Context, userID string, in WorkoutInput) (Workout, error) {
	if err := s.validate(ctx, userID, in); err != nil {
		return Workout{}, err
	}
	now := s.now().UnixMilli()
	start := in.StartTime
	if start == 0 {
		start = now
	}
	id := uuid.NewString()
	err := s.inTx(ctx, func(qtx *sqlc.Queries) error {
		if _, err := qtx.CreateWorkout(ctx, sqlc.CreateWorkoutParams{
			ID: id, UserID: userID, RoutineID: sqlnull.String(in.RoutineID), Title: in.Title, Notes: in.Notes,
			StartTime: start, EndTime: sqlnull.Int64(in.EndTime), CreatedAt: now, UpdatedAt: now,
		}); err != nil {
			return err
		}
		return insertChildren(ctx, qtx, id, in.Exercises, now)
	})
	if err != nil {
		return Workout{}, err
	}
	return s.Get(ctx, userID, id)
}

// Update replaces a workout's metadata and children in a transaction.
func (s *Service) Update(ctx context.Context, userID, id string, in WorkoutInput) (Workout, error) {
	if err := s.validate(ctx, userID, in); err != nil {
		return Workout{}, err
	}
	w, err := s.q.GetWorkout(ctx, id)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && w.UserID != userID) {
		return Workout{}, apperr.NotFound("workout not found")
	}
	if err != nil {
		return Workout{}, err
	}
	now := s.now().UnixMilli()
	start := in.StartTime
	if start == 0 {
		start = w.StartTime
	}
	err = s.inTx(ctx, func(qtx *sqlc.Queries) error {
		if _, err := qtx.UpdateWorkoutMeta(ctx, sqlc.UpdateWorkoutMetaParams{
			RoutineID: sqlnull.String(in.RoutineID), Title: in.Title, Notes: in.Notes, StartTime: start,
			EndTime: sqlnull.Int64(in.EndTime), UpdatedAt: now, ID: id, UserID: userID,
		}); err != nil {
			return err
		}
		if err := qtx.DeleteWorkoutExercisesByWorkout(ctx, id); err != nil {
			return err
		}
		return insertChildren(ctx, qtx, id, in.Exercises, now)
	})
	if err != nil {
		return Workout{}, err
	}
	return s.Get(ctx, userID, id)
}

// Delete soft-deletes a workout.
func (s *Service) Delete(ctx context.Context, userID, id string) error {
	now := s.now().UnixMilli()
	rows, err := s.q.SoftDeleteWorkout(ctx, sqlc.SoftDeleteWorkoutParams{
		DeletedAt: sql.NullInt64{Int64: now, Valid: true}, UpdatedAt: now, ID: id, UserID: userID,
	})
	if err != nil {
		return err
	}
	if rows == 0 {
		return apperr.NotFound("workout not found")
	}
	return nil
}

// --- helpers ----------------------------------------------------------------

func (s *Service) inTx(ctx context.Context, fn func(*sqlc.Queries) error) error {
	return db.InTx(ctx, s.db, s.q, fn)
}

func insertChildren(ctx context.Context, qtx *sqlc.Queries, workoutID string, exs []WorkoutExerciseInput, now int64) error {
	for ei, ex := range exs {
		weID := uuid.NewString()
		if _, err := qtx.CreateWorkoutExercise(ctx, sqlc.CreateWorkoutExerciseParams{
			ID: weID, WorkoutID: workoutID, ExerciseID: ex.ExerciseID, OrderIndex: int64(ei),
			Notes: ex.Notes, SupersetGroup: sqlnull.Int(ex.SupersetGroup), CreatedAt: now, UpdatedAt: now,
		}); err != nil {
			return err
		}
		for si, st := range ex.Sets {
			setType := st.SetType
			if setType == "" {
				setType = "normal"
			}
			if _, err := qtx.CreateWorkoutSet(ctx, sqlc.CreateWorkoutSetParams{
				ID: uuid.NewString(), WorkoutExerciseID: weID, OrderIndex: int64(si), SetType: setType,
				Weight: sqlnull.Float64(st.Weight), Reps: sqlnull.Int(st.Reps), Rpe: sqlnull.Float64(st.RPE),
				Duration: sqlnull.Int(st.Duration), Distance: sqlnull.Float64(st.Distance),
				IsCompleted: boolToInt(st.IsCompleted), CreatedAt: now, UpdatedAt: now,
			}); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *Service) loadNested(ctx context.Context, w sqlc.Workout) (Workout, error) {
	out := meta(w)
	exs, err := s.q.ListWorkoutExercises(ctx, w.ID)
	if err != nil {
		return Workout{}, err
	}
	sets, err := s.q.ListWorkoutSetsForWorkout(ctx, w.ID)
	if err != nil {
		return Workout{}, err
	}
	byWE := map[string][]WorkoutSet{}
	for _, st := range sets {
		byWE[st.WorkoutExerciseID] = append(byWE[st.WorkoutExerciseID], WorkoutSet{
			ID: st.ID, OrderIndex: int(st.OrderIndex), SetType: st.SetType,
			Weight: sqlnull.Float64Ptr(st.Weight), Reps: sqlnull.IntPtr(st.Reps), RPE: sqlnull.Float64Ptr(st.Rpe),
			Duration: sqlnull.IntPtr(st.Duration), Distance: sqlnull.Float64Ptr(st.Distance), IsCompleted: st.IsCompleted != 0,
		})
	}
	for _, e := range exs {
		setsForE := byWE[e.ID]
		if setsForE == nil {
			setsForE = []WorkoutSet{}
		}
		out.Exercises = append(out.Exercises, WorkoutExercise{
			ID: e.ID, ExerciseID: e.ExerciseID, OrderIndex: int(e.OrderIndex), Notes: e.Notes,
			SupersetGroup: sqlnull.IntPtr(e.SupersetGroup), Sets: setsForE,
		})
	}
	return out, nil
}

func (s *Service) validate(ctx context.Context, userID string, in WorkoutInput) error {
	if in.RoutineID != nil {
		r, err := s.q.GetRoutine(ctx, *in.RoutineID)
		if errors.Is(err, sql.ErrNoRows) || (err == nil && r.UserID != userID) {
			return apperr.Validation("unknown routine")
		}
		if err != nil {
			return err
		}
	}
	for _, ex := range in.Exercises {
		e, err := s.q.GetExercise(ctx, ex.ExerciseID)
		if errors.Is(err, sql.ErrNoRows) || (err == nil && e.UserID.Valid && e.UserID.String != userID) {
			return apperr.Validation("unknown exercise: " + ex.ExerciseID)
		}
		if err != nil {
			return err
		}
		for _, st := range ex.Sets {
			if st.SetType != "" && !validSetTypes[st.SetType] {
				return apperr.Validation("invalid set_type: " + st.SetType)
			}
		}
	}
	return nil
}

func meta(w sqlc.Workout) Workout {
	return Workout{
		ID: w.ID, RoutineID: sqlnull.StringPtr(w.RoutineID), Title: w.Title, Notes: w.Notes,
		StartTime: w.StartTime, EndTime: sqlnull.Int64Ptr(w.EndTime), CreatedAt: w.CreatedAt, UpdatedAt: w.UpdatedAt,
		Exercises: []WorkoutExercise{},
	}
}

func boolToInt(b bool) int64 {
	if b {
		return 1
	}
	return 0
}
