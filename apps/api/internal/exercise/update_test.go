package exercise

import (
	"context"
	"testing"
)

func TestUpdateArchiveAndNotFound(t *testing.T) {
	s, _, uid := newTestService(t)
	ctx := context.Background()

	created, err := s.Create(ctx, uid, validInput("Archivable"))
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	in := validInput("Archivable")
	in.IsArchived = true
	updated, err := s.Update(ctx, uid, created.ID, in)
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if !updated.IsArchived {
		t.Error("IsArchived should be true after archiving")
	}

	if _, err := s.Update(ctx, uid, "nope", validInput("x")); err == nil {
		t.Error("Update(unknown) should error")
	}
}
