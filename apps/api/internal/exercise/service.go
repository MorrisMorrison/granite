// Package exercise provides exercise-library use-cases: a per-user set of custom
// exercises plus a shared, read-only built-in library (user_id NULL).
package exercise

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/MorrisMorrison/granite/apps/api/internal/apperr"
	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
)

// Service implements exercise use-cases over the data store.
type Service struct {
	q   *sqlc.Queries
	now func() time.Time
}

// NewService constructs an exercise Service.
func NewService(q *sqlc.Queries) *Service { return &Service{q: q, now: time.Now} }

// Exercise is the client-facing representation.
type Exercise struct {
	ID               string          `json:"id"`
	Name             string          `json:"name"`
	ExerciseType     string          `json:"exercise_type"`
	PrimaryMuscle    string          `json:"primary_muscle"`
	SecondaryMuscles json.RawMessage `json:"secondary_muscles"`
	Equipment        string          `json:"equipment"`
	Instructions     string          `json:"instructions"`
	IsArchived       bool            `json:"is_archived"`
	IsBuiltin        bool            `json:"is_builtin"`
	CreatedAt        int64           `json:"created_at"`
	UpdatedAt        int64           `json:"updated_at"`
}

// Input carries create/update fields.
type Input struct {
	Name             string
	ExerciseType     string
	PrimaryMuscle    string
	SecondaryMuscles json.RawMessage
	Equipment        string
	Instructions     string
	IsArchived       bool
}

var validTypes = map[string]bool{"weight_reps": true, "reps_only": true, "duration": true}

// List returns the user's exercises plus the built-in library, name-sorted.
func (s *Service) List(ctx context.Context, userID string) ([]Exercise, error) {
	rows, err := s.q.ListExercises(ctx, sql.NullString{String: userID, Valid: true})
	if err != nil {
		return nil, err
	}
	out := make([]Exercise, 0, len(rows))
	for _, r := range rows {
		out = append(out, toExercise(r))
	}
	return out, nil
}

// Get returns one exercise visible to the user (owned or built-in).
func (s *Service) Get(ctx context.Context, userID, id string) (Exercise, error) {
	e, err := s.fetchVisible(ctx, userID, id)
	if err != nil {
		return Exercise{}, err
	}
	return toExercise(e), nil
}

// Create adds a custom exercise owned by the user.
func (s *Service) Create(ctx context.Context, userID string, in Input) (Exercise, error) {
	if err := validate(in); err != nil {
		return Exercise{}, err
	}
	now := s.now().UnixMilli()
	// The server generates the id here; the sync slice (Phase 3) will accept
	// client-generated UUIDv7 ids for offline-first creates.
	e, err := s.q.CreateExercise(ctx, sqlc.CreateExerciseParams{
		ID:               uuid.NewString(),
		UserID:           sql.NullString{String: userID, Valid: true},
		Name:             strings.TrimSpace(in.Name),
		ExerciseType:     in.ExerciseType,
		PrimaryMuscle:    in.PrimaryMuscle,
		SecondaryMuscles: secondaryOrEmpty(in.SecondaryMuscles),
		Equipment:        in.Equipment,
		Instructions:     in.Instructions,
		IsArchived:       boolToInt(in.IsArchived),
		CreatedAt:        now,
		UpdatedAt:        now,
	})
	if err != nil {
		return Exercise{}, err
	}
	return toExercise(e), nil
}

// Update modifies a user-owned exercise. Built-ins are read-only.
func (s *Service) Update(ctx context.Context, userID, id string, in Input) (Exercise, error) {
	if err := validate(in); err != nil {
		return Exercise{}, err
	}
	existing, err := s.fetchVisible(ctx, userID, id)
	if err != nil {
		return Exercise{}, err
	}
	if !existing.UserID.Valid {
		return Exercise{}, apperr.Forbidden("built-in exercises cannot be edited")
	}
	e, err := s.q.UpdateExercise(ctx, sqlc.UpdateExerciseParams{
		Name:             strings.TrimSpace(in.Name),
		ExerciseType:     in.ExerciseType,
		PrimaryMuscle:    in.PrimaryMuscle,
		SecondaryMuscles: secondaryOrEmpty(in.SecondaryMuscles),
		Equipment:        in.Equipment,
		Instructions:     in.Instructions,
		IsArchived:       boolToInt(in.IsArchived),
		UpdatedAt:        s.now().UnixMilli(),
		ID:               id,
		UserID:           sql.NullString{String: userID, Valid: true},
	})
	if errors.Is(err, sql.ErrNoRows) {
		return Exercise{}, apperr.NotFound("exercise not found")
	}
	if err != nil {
		return Exercise{}, err
	}
	return toExercise(e), nil
}

// Delete soft-deletes a user-owned exercise. Built-ins are read-only.
func (s *Service) Delete(ctx context.Context, userID, id string) error {
	existing, err := s.fetchVisible(ctx, userID, id)
	if err != nil {
		return err
	}
	if !existing.UserID.Valid {
		return apperr.Forbidden("built-in exercises cannot be deleted")
	}
	now := s.now().UnixMilli()
	rows, err := s.q.SoftDeleteExercise(ctx, sqlc.SoftDeleteExerciseParams{
		DeletedAt: sql.NullInt64{Int64: now, Valid: true},
		UpdatedAt: now,
		ID:        id,
		UserID:    sql.NullString{String: userID, Valid: true},
	})
	if err != nil {
		return err
	}
	if rows == 0 {
		return apperr.NotFound("exercise not found")
	}
	return nil
}

// fetchVisible returns the row if it exists and is visible to userID (owned or
// built-in); otherwise NotFound (no cross-user existence disclosure).
func (s *Service) fetchVisible(ctx context.Context, userID, id string) (sqlc.Exercise, error) {
	e, err := s.q.GetExercise(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return sqlc.Exercise{}, apperr.NotFound("exercise not found")
	}
	if err != nil {
		return sqlc.Exercise{}, err
	}
	if e.UserID.Valid && e.UserID.String != userID {
		return sqlc.Exercise{}, apperr.NotFound("exercise not found")
	}
	return e, nil
}

func validate(in Input) error {
	if strings.TrimSpace(in.Name) == "" {
		return apperr.Validation("exercise name is required")
	}
	if !validTypes[in.ExerciseType] {
		return apperr.Validation("exercise_type must be one of: weight_reps, reps_only, duration")
	}
	if in.SecondaryMuscles != nil && !json.Valid(in.SecondaryMuscles) {
		return apperr.Validation("secondary_muscles must be valid JSON")
	}
	return nil
}

func secondaryOrEmpty(j json.RawMessage) string {
	if len(j) == 0 {
		return "[]"
	}
	return string(j)
}

func boolToInt(b bool) int64 {
	if b {
		return 1
	}
	return 0
}

func toExercise(e sqlc.Exercise) Exercise {
	return Exercise{
		ID:               e.ID,
		Name:             e.Name,
		ExerciseType:     e.ExerciseType,
		PrimaryMuscle:    e.PrimaryMuscle,
		SecondaryMuscles: json.RawMessage(e.SecondaryMuscles),
		Equipment:        e.Equipment,
		Instructions:     e.Instructions,
		IsArchived:       e.IsArchived != 0,
		IsBuiltin:        !e.UserID.Valid,
		CreatedAt:        e.CreatedAt,
		UpdatedAt:        e.UpdatedAt,
	}
}
