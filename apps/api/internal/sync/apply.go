package sync

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/google/uuid"

	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
)

func (s *Service) inTx(ctx context.Context, fn func(*sqlc.Queries) error) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if err := fn(s.q.WithTx(tx)); err != nil {
		return err
	}
	return tx.Commit()
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
		if existing.UserID.Valid && existing.UserID.String != userID {
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
			ID: c.ID, UserID: userID, FolderID: nullStr(d.FolderID), Title: d.Title, Notes: d.Notes,
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
				Notes: ex.Notes, RestSeconds: ex.RestSeconds, SupersetGroup: nullI64(ex.SupersetGroup),
				CreatedAt: created, UpdatedAt: c.UpdatedAt,
			}); err != nil {
				return err
			}
			for _, st := range ex.Sets {
				if _, err := qtx.CreateRoutineSet(ctx, sqlc.CreateRoutineSetParams{
					ID: orID(st.ID), RoutineExerciseID: reID, OrderIndex: st.OrderIndex,
					SetType: orDefault(st.SetType, "normal"), TargetWeight: nullF64(st.TargetWeight),
					TargetReps: nullI64(st.TargetReps), TargetRpe: nullF64(st.TargetRpe),
					TargetDuration: nullI64(st.TargetDuration), CreatedAt: created, UpdatedAt: c.UpdatedAt,
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
			ID: c.ID, UserID: userID, RoutineID: nullStr(d.RoutineID), Title: d.Title, Notes: d.Notes,
			StartTime: nz(d.StartTime, c.UpdatedAt), EndTime: nullI64(d.EndTime), CreatedAt: created,
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
				Notes: ex.Notes, SupersetGroup: nullI64(ex.SupersetGroup), CreatedAt: created, UpdatedAt: c.UpdatedAt,
			}); err != nil {
				return err
			}
			for _, st := range ex.Sets {
				if _, err := qtx.CreateWorkoutSet(ctx, sqlc.CreateWorkoutSetParams{
					ID: orID(st.ID), WorkoutExerciseID: weID, OrderIndex: st.OrderIndex,
					SetType: orDefault(st.SetType, "normal"), Weight: nullF64(st.Weight), Reps: nullI64(st.Reps),
					Rpe: nullF64(st.Rpe), Duration: nullI64(st.Duration), Distance: nullF64(st.Distance),
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
			deleted_at = excluded.deleted_at`,
		c.ID, userID, d.Weight, d.RecordedAt, nz(d.CreatedAt, c.UpdatedAt), c.UpdatedAt, deletedAt(c)); err != nil {
		return false, err
	}
	return true, nil
}
