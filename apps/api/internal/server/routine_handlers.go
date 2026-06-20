package server

import (
	"context"

	"github.com/MorrisMorrison/granite/apps/api/internal/routine"
)

// --- Folders ----------------------------------------------------------------

type listFoldersOutput struct {
	Body struct {
		Folders []routine.Folder `json:"folders"`
	}
}

func (s *Server) handleListFolders(ctx context.Context, _ *struct{}) (*listFoldersOutput, error) {
	folders, err := s.routine.ListFolders(ctx, userIDFromCtx(ctx))
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	out := &listFoldersOutput{}
	out.Body.Folders = folders
	if out.Body.Folders == nil {
		out.Body.Folders = []routine.Folder{}
	}
	return out, nil
}

type folderOutput struct {
	Body routine.Folder
}

type createFolderInput struct {
	Body routine.FolderInput
}

func (s *Server) handleCreateFolder(ctx context.Context, in *createFolderInput) (*folderOutput, error) {
	f, err := s.routine.CreateFolder(ctx, userIDFromCtx(ctx), in.Body)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return &folderOutput{Body: f}, nil
}

type updateFolderInput struct {
	ID   string `path:"id"`
	Body routine.FolderInput
}

func (s *Server) handleUpdateFolder(ctx context.Context, in *updateFolderInput) (*folderOutput, error) {
	f, err := s.routine.UpdateFolder(ctx, userIDFromCtx(ctx), in.ID, in.Body)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return &folderOutput{Body: f}, nil
}

type idPathInput struct {
	ID string `path:"id"`
}

func (s *Server) handleDeleteFolder(ctx context.Context, in *idPathInput) (*struct{}, error) {
	if err := s.routine.DeleteFolder(ctx, userIDFromCtx(ctx), in.ID); err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return nil, nil
}

// --- Routines ---------------------------------------------------------------

type listRoutinesOutput struct {
	Body struct {
		Routines []routine.Routine `json:"routines"`
	}
}

func (s *Server) handleListRoutines(ctx context.Context, _ *struct{}) (*listRoutinesOutput, error) {
	routines, err := s.routine.ListRoutines(ctx, userIDFromCtx(ctx))
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	out := &listRoutinesOutput{}
	out.Body.Routines = routines
	if out.Body.Routines == nil {
		out.Body.Routines = []routine.Routine{}
	}
	return out, nil
}

type routineOutput struct {
	Body routine.Routine
}

func (s *Server) handleGetRoutine(ctx context.Context, in *idPathInput) (*routineOutput, error) {
	r, err := s.routine.Get(ctx, userIDFromCtx(ctx), in.ID)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return &routineOutput{Body: r}, nil
}

type createRoutineInput struct {
	Body routine.RoutineInput
}

func (s *Server) handleCreateRoutine(ctx context.Context, in *createRoutineInput) (*routineOutput, error) {
	r, err := s.routine.Create(ctx, userIDFromCtx(ctx), in.Body)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return &routineOutput{Body: r}, nil
}

type updateRoutineInput struct {
	ID   string `path:"id"`
	Body routine.RoutineInput
}

func (s *Server) handleUpdateRoutine(ctx context.Context, in *updateRoutineInput) (*routineOutput, error) {
	r, err := s.routine.Update(ctx, userIDFromCtx(ctx), in.ID, in.Body)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return &routineOutput{Body: r}, nil
}

func (s *Server) handleDeleteRoutine(ctx context.Context, in *idPathInput) (*struct{}, error) {
	if err := s.routine.Delete(ctx, userIDFromCtx(ctx), in.ID); err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return nil, nil
}
