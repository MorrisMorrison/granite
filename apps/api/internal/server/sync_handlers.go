package server

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	syncpkg "github.com/MorrisMorrison/granite/apps/api/internal/sync"
)

// registerSyncRoutes wires the offline-first delta-sync endpoints.
func (s *Server) registerSyncRoutes(a huma.API) {
	huma.Register(a, huma.Operation{OperationID: "syncPull", Method: http.MethodPost, Path: "/api/v1/sync/pull", Summary: "Pull changes since a cursor", Tags: []string{"Sync"}, Security: bearerSecurity, Metadata: map[string]any{metaReadOnly: true}}, s.handleSyncPull)
	huma.Register(a, huma.Operation{OperationID: "syncPush", Method: http.MethodPost, Path: "/api/v1/sync/push", Summary: "Push local changes", Tags: []string{"Sync"}, Security: bearerSecurity}, s.handleSyncPush)
}

// apiChange is the wire form of a sync change. Data is free-form JSON (the
// record's fields); huma renders `any` as an unconstrained schema.
type apiChange struct {
	Entity    string `json:"entity"`
	ID        string `json:"id"`
	UpdatedAt int64  `json:"updated_at" doc:"Record's last-modified time (epoch ms); the LWW key."`
	Deleted   bool   `json:"deleted"`
	Data      any    `json:"data"`
}

type syncPullInput struct {
	Body struct {
		Since int64 `json:"since" doc:"Cursor from a previous pull/push (epoch ms); 0 for a full sync."`
	}
}

type syncPullOutput struct {
	Body struct {
		Changes []apiChange `json:"changes"`
		Cursor  int64       `json:"cursor"`
	}
}

func (s *Server) handleSyncPull(ctx context.Context, in *syncPullInput) (*syncPullOutput, error) {
	changes, cursor, err := s.sync.Pull(ctx, userIDFromCtx(ctx), in.Body.Since)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	out := &syncPullOutput{}
	out.Body.Changes = toAPIChanges(changes)
	out.Body.Cursor = cursor
	return out, nil
}

type syncPushInput struct {
	Body struct {
		Changes []apiChange `json:"changes"`
	}
}

type syncPushOutput struct {
	Body struct {
		Applied []string `json:"applied" doc:"IDs accepted by the server (others lost a last-write-wins race)."`
		Cursor  int64    `json:"cursor"`
	}
}

func (s *Server) handleSyncPush(ctx context.Context, in *syncPushInput) (*syncPushOutput, error) {
	changes, err := fromAPIChanges(in.Body.Changes)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	applied, err := s.sync.Push(ctx, userIDFromCtx(ctx), changes)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	out := &syncPushOutput{}
	out.Body.Applied = applied
	out.Body.Cursor = maxUpdatedAt(changes)
	return out, nil
}

func toAPIChanges(cs []syncpkg.Change) []apiChange {
	out := make([]apiChange, 0, len(cs))
	for _, c := range cs {
		var data any
		if len(c.Data) > 0 {
			_ = json.Unmarshal(c.Data, &data)
		}
		out = append(out, apiChange{Entity: c.Entity, ID: c.ID, UpdatedAt: c.UpdatedAt, Deleted: c.Deleted, Data: data})
	}
	return out
}

func fromAPIChanges(cs []apiChange) ([]syncpkg.Change, error) {
	out := make([]syncpkg.Change, 0, len(cs))
	for _, c := range cs {
		var raw json.RawMessage
		if c.Data != nil {
			b, err := json.Marshal(c.Data)
			if err != nil {
				return nil, err
			}
			raw = b
		}
		out = append(out, syncpkg.Change{Entity: c.Entity, ID: c.ID, UpdatedAt: c.UpdatedAt, Deleted: c.Deleted, Data: raw})
	}
	return out, nil
}

func maxUpdatedAt(cs []syncpkg.Change) int64 {
	var max int64
	for _, c := range cs {
		if c.UpdatedAt > max {
			max = c.UpdatedAt
		}
	}
	return max
}
