package sync

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"

	"github.com/google/uuid"

	"github.com/MorrisMorrison/granite/apps/api/internal/apperr"
	"github.com/MorrisMorrison/granite/apps/api/internal/db"
	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
	"github.com/MorrisMorrison/granite/apps/api/internal/sqlnull"
)

// validate rejects incoming changes that the REST services would 400 on, so the
// sync write path can't persist data that bypassed the domain rules. Returns an
// apperr.Validation (→ 400) on bad input. Deletes carry no meaningful payload,
// so they skip content validation.
func validate(c Change) error {
	if c.Deleted {
		return nil
	}
	switch c.Entity {
	case EntityRoutine:
		var d routineData
		if err := json.Unmarshal(c.Data, &d); err != nil {
			return apperr.Validation("invalid routine data")
		}
		if strings.TrimSpace(d.Title) == "" {
			return apperr.Validation("routine title is required")
		}
		for _, ex := range d.Exercises {
			for _, st := range ex.Sets {
				if st.SetType != "" && !validSetTypes[st.SetType] {
					return apperr.Validation("invalid set_type: " + st.SetType)
				}
			}
		}
	case EntityWorkout:
		var d workoutData
		if err := json.Unmarshal(c.Data, &d); err != nil {
			return apperr.Validation("invalid workout data")
		}
		// A workout title is optional (unlike a routine), so it is not required.
		for _, ex := range d.Exercises {
			for _, st := range ex.Sets {
				if st.SetType != "" && !validSetTypes[st.SetType] {
					return apperr.Validation("invalid set_type: " + st.SetType)
				}
			}
		}
	}
	return nil
}

func (s *Service) inTx(ctx context.Context, fn func(*sqlc.Queries) error) error {
	return db.InTx(ctx, s.db, s.q, fn)
}

// nz returns v unless it's zero, in which case fallback.
func nz(v, fallback int64) int64 {
	if v == 0 {
		return fallback
	}
	return v
}

func (s *Service) applyExercise(ctx context.Context, userID string, c Change) (bool, error) {
	existing, err := s.q.GetExerciseForSync(ctx, c.ID)
	switch {
	case err == nil:
		if !existing.UserID.Valid {
			return false, nil // built-in (user_id NULL) — read-only, matches CRUD guard/ADR-0008
		}
		if existing.UserID.String != userID {
			return false, nil // not the owner
		}
		if c.UpdatedAt < existing.UpdatedAt {
			return false, nil // older — keep server's
		}
	case errors.Is(err, sql.ErrNoRows):
	default:
		return false, err
	}
	var d exerciseData
	if err := json.Unmarshal(c.Data, &d); err != nil {
		return false, err
	}
	sec := string(d.SecondaryMuscles)
	if sec == "" {
		sec = "[]"
	}
	if err := s.q.UpsertExercise(ctx, sqlc.UpsertExerciseParams{
		ID:               c.ID,
		UserID:           sql.NullString{String: userID, Valid: true},
		Name:             d.Name,
		ExerciseType:     orDefault(d.ExerciseType, "weight_reps"),
		PrimaryMuscle:    d.PrimaryMuscle,
		SecondaryMuscles: sec,
		Equipment:        d.Equipment,
		Instructions:     d.Instructions,
		IsArchived:       b2i(d.IsArchived),
		CreatedAt:        nz(d.CreatedAt, c.UpdatedAt),
		UpdatedAt:        c.UpdatedAt,
		DeletedAt:        deletedAt(c),
	}); err != nil {
		return false, err
	}
	return true, nil
}

func (s *Service) applyFolder(ctx context.Context, userID string, c Change) (bool, error) {
	existing, err := s.q.GetRoutineFolderForSync(ctx, c.ID)
	switch {
	case err == nil:
		if existing.UserID != userID {
			return false, nil
		}
		if c.UpdatedAt < existing.UpdatedAt {
			return false, nil
		}
	case errors.Is(err, sql.ErrNoRows):
	default:
		return false, err
	}
	var d folderData
	if err := json.Unmarshal(c.Data, &d); err != nil {
		return false, err
	}
	if err := s.q.UpsertRoutineFolder(ctx, sqlc.UpsertRoutineFolderParams{
		ID: c.ID, UserID: userID, Name: d.Name, OrderIndex: d.OrderIndex,
		CreatedAt: nz(d.CreatedAt, c.UpdatedAt), UpdatedAt: c.UpdatedAt, DeletedAt: deletedAt(c),
	}); err != nil {
		return false, err
	}
	return true, nil
}

func (s *Service) applyRoutine(ctx context.Context, userID string, c Change) (bool, error) {
	existing, err := s.q.GetRoutineForSync(ctx, c.ID)
	switch {
	case err == nil:
		if existing.UserID != userID {
			return false, nil
		}
		if c.UpdatedAt < existing.UpdatedAt {
			return false, nil
		}
	case errors.Is(err, sql.ErrNoRows):
	default:
		return false, err
	}
	var d routineData
	if err := json.Unmarshal(c.Data, &d); err != nil {
		return false, err
	}
	created := nz(d.CreatedAt, c.UpdatedAt)
	err = s.inTx(ctx, func(qtx *sqlc.Queries) error {
		if err := qtx.UpsertRoutine(ctx, sqlc.UpsertRoutineParams{
			ID: c.ID, UserID: userID, FolderID: sqlnull.String(d.FolderID), Title: d.Title, Notes: d.Notes,
			OrderIndex: d.OrderIndex, CreatedAt: created, UpdatedAt: c.UpdatedAt, DeletedAt: deletedAt(c),
		}); err != nil {
			return err
		}
		if c.Deleted {
			return nil
		}
		if err := qtx.DeleteRoutineExercisesByRoutine(ctx, c.ID); err != nil {
			return err
		}
		for _, ex := range d.Exercises {
			reID := orID(ex.ID)
			if _, err := qtx.CreateRoutineExercise(ctx, sqlc.CreateRoutineExerciseParams{
				ID: reID, RoutineID: c.ID, ExerciseID: ex.ExerciseID, OrderIndex: ex.OrderIndex,
				Notes: ex.Notes, RestSeconds: ex.RestSeconds, SupersetGroup: sqlnull.Int64(ex.SupersetGroup),
				CreatedAt: created, UpdatedAt: c.UpdatedAt,
			}); err != nil {
				return err
			}
			for _, st := range ex.Sets {
				if _, err := qtx.CreateRoutineSet(ctx, sqlc.CreateRoutineSetParams{
					ID: orID(st.ID), RoutineExerciseID: reID, OrderIndex: st.OrderIndex,
					SetType: orDefault(st.SetType, "normal"), TargetWeight: sqlnull.Float64(st.TargetWeight),
					TargetReps: sqlnull.Int64(st.TargetReps), TargetRpe: sqlnull.Float64(st.TargetRpe),
					TargetDuration: sqlnull.Int64(st.TargetDuration), CreatedAt: created, UpdatedAt: c.UpdatedAt,
				}); err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *Service) applyWorkout(ctx context.Context, userID string, c Change) (bool, error) {
	existing, err := s.q.GetWorkoutForSync(ctx, c.ID)
	switch {
	case err == nil:
		if existing.UserID != userID {
			return false, nil
		}
		if c.UpdatedAt < existing.UpdatedAt {
			return false, nil
		}
	case errors.Is(err, sql.ErrNoRows):
	default:
		return false, err
	}
	var d workoutData
	if err := json.Unmarshal(c.Data, &d); err != nil {
		return false, err
	}
	created := nz(d.CreatedAt, c.UpdatedAt)
	err = s.inTx(ctx, func(qtx *sqlc.Queries) error {
		if err := qtx.UpsertWorkout(ctx, sqlc.UpsertWorkoutParams{
			ID: c.ID, UserID: userID, RoutineID: sqlnull.String(d.RoutineID), Title: d.Title, Notes: d.Notes,
			StartTime: nz(d.StartTime, c.UpdatedAt), EndTime: sqlnull.Int64(d.EndTime), CreatedAt: created,
			UpdatedAt: c.UpdatedAt, DeletedAt: deletedAt(c),
		}); err != nil {
			return err
		}
		if c.Deleted {
			return nil
		}
		if err := qtx.DeleteWorkoutExercisesByWorkout(ctx, c.ID); err != nil {
			return err
		}
		for _, ex := range d.Exercises {
			weID := orID(ex.ID)
			if _, err := qtx.CreateWorkoutExercise(ctx, sqlc.CreateWorkoutExerciseParams{
				ID: weID, WorkoutID: c.ID, ExerciseID: ex.ExerciseID, OrderIndex: ex.OrderIndex,
				Notes: ex.Notes, SupersetGroup: sqlnull.Int64(ex.SupersetGroup), CreatedAt: created, UpdatedAt: c.UpdatedAt,
			}); err != nil {
				return err
			}
			for _, st := range ex.Sets {
				if _, err := qtx.CreateWorkoutSet(ctx, sqlc.CreateWorkoutSetParams{
					ID: orID(st.ID), WorkoutExerciseID: weID, OrderIndex: st.OrderIndex,
					SetType: orDefault(st.SetType, "normal"), Weight: sqlnull.Float64(st.Weight), Reps: sqlnull.Int64(st.Reps),
					Rpe: sqlnull.Float64(st.Rpe), Duration: sqlnull.Int64(st.Duration), Distance: sqlnull.Float64(st.Distance),
					IsCompleted: b2i(st.IsCompleted), CreatedAt: created, UpdatedAt: c.UpdatedAt,
				}); err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		return false, err
	}
	return true, nil
}

func orID(id string) string {
	if id == "" {
		return uuid.NewString()
	}
	return id
}

// applyBodyweight upserts a bodyweight weigh-in. Raw SQL (bodyweight isn't in
// sqlc) but mirrors the LWW + ownership semantics of the other entities.
func (s *Service) applyBodyweight(ctx context.Context, userID string, c Change) (bool, error) {
	var ownerID string
	var existingUpdated int64
	err := s.db.QueryRowContext(ctx, "SELECT user_id, updated_at FROM bodyweight WHERE id = ?", c.ID).
		Scan(&ownerID, &existingUpdated)
	switch {
	case err == nil:
		if ownerID != userID {
			return false, nil // can't clobber another account's record
		}
		if c.UpdatedAt < existingUpdated {
			return false, nil // older than what we have
		}
	case errors.Is(err, sql.ErrNoRows):
	default:
		return false, err
	}

	var d bodyweightData
	if err := json.Unmarshal(c.Data, &d); err != nil {
		return false, err
	}
	if _, err := s.db.ExecContext(ctx, `
		INSERT INTO bodyweight (id, user_id, weight, recorded_at, created_at, updated_at, deleted_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			weight = excluded.weight,
			recorded_at = excluded.recorded_at,
			updated_at = excluded.updated_at,
			deleted_at = excluded.deleted_at
		WHERE excluded.updated_at >= bodyweight.updated_at`,
		c.ID, userID, d.Weight, d.RecordedAt, nz(d.CreatedAt, c.UpdatedAt), c.UpdatedAt, deletedAt(c)); err != nil {
		return false, err
	}
	return true, nil
}
