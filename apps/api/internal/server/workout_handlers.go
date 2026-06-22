package server

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/MorrisMorrison/granite/apps/api/internal/workout"
)

// registerWorkoutRoutes wires the workout-logging endpoints.
func (s *Server) registerWorkoutRoutes(a huma.API) {
	huma.Register(a, huma.Operation{OperationID: "listWorkouts", Method: http.MethodGet, Path: "/api/v1/workouts", Summary: "List workouts (metadata)", Tags: []string{"Workouts"}, Security: bearerSecurity}, s.handleListWorkouts)
	huma.Register(a, huma.Operation{OperationID: "createWorkout", Method: http.MethodPost, Path: "/api/v1/workouts", Summary: "Log a workout", Tags: []string{"Workouts"}, Security: bearerSecurity, DefaultStatus: http.StatusCreated}, s.handleCreateWorkout)
	huma.Register(a, huma.Operation{OperationID: "getWorkout", Method: http.MethodGet, Path: "/api/v1/workouts/{id}", Summary: "Get a workout (full)", Tags: []string{"Workouts"}, Security: bearerSecurity}, s.handleGetWorkout)
	huma.Register(a, huma.Operation{OperationID: "updateWorkout", Method: http.MethodPatch, Path: "/api/v1/workouts/{id}", Summary: "Update a workout", Tags: []string{"Workouts"}, Security: bearerSecurity}, s.handleUpdateWorkout)
	huma.Register(a, huma.Operation{OperationID: "deleteWorkout", Method: http.MethodDelete, Path: "/api/v1/workouts/{id}", Summary: "Delete a workout", Tags: []string{"Workouts"}, Security: bearerSecurity, DefaultStatus: http.StatusNoContent}, s.handleDeleteWorkout)
}

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
