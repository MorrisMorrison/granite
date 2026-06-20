package server

import (
	"context"

	"github.com/MorrisMorrison/granite/apps/api/internal/workout"
)

type listWorkoutsOutput struct {
	Body struct {
		Workouts []workout.Workout `json:"workouts"`
	}
}

func (s *Server) handleListWorkouts(ctx context.Context, _ *struct{}) (*listWorkoutsOutput, error) {
	ws, err := s.workout.List(ctx, userIDFromCtx(ctx))
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	out := &listWorkoutsOutput{}
	out.Body.Workouts = ws
	if out.Body.Workouts == nil {
		out.Body.Workouts = []workout.Workout{}
	}
	return out, nil
}

type workoutOutput struct {
	Body workout.Workout
}

func (s *Server) handleGetWorkout(ctx context.Context, in *idPathInput) (*workoutOutput, error) {
	w, err := s.workout.Get(ctx, userIDFromCtx(ctx), in.ID)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return &workoutOutput{Body: w}, nil
}

type createWorkoutInput struct {
	Body workout.WorkoutInput
}

func (s *Server) handleCreateWorkout(ctx context.Context, in *createWorkoutInput) (*workoutOutput, error) {
	w, err := s.workout.Create(ctx, userIDFromCtx(ctx), in.Body)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return &workoutOutput{Body: w}, nil
}

type updateWorkoutInput struct {
	ID   string `path:"id"`
	Body workout.WorkoutInput
}

func (s *Server) handleUpdateWorkout(ctx context.Context, in *updateWorkoutInput) (*workoutOutput, error) {
	w, err := s.workout.Update(ctx, userIDFromCtx(ctx), in.ID, in.Body)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return &workoutOutput{Body: w}, nil
}

func (s *Server) handleDeleteWorkout(ctx context.Context, in *idPathInput) (*struct{}, error) {
	if err := s.workout.Delete(ctx, userIDFromCtx(ctx), in.ID); err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return nil, nil
}
