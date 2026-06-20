package exercise

import (
	"context"
	"testing"
	"time"
)

func fixedNow() func() time.Time { return func() time.Time { return time.Unix(0, 0) } }

func TestSeedBuiltinsIdempotent(t *testing.T) {
	s, q, uid := newTestService(t)
	ctx := context.Background()

	n, err := SeedBuiltins(ctx, q, fixedNow())
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	if n != len(builtinExercises) || n == 0 {
		t.Fatalf("inserted %d, want %d", n, len(builtinExercises))
	}

	// Second run is a no-op.
	again, err := SeedBuiltins(ctx, q, fixedNow())
	if err != nil {
		t.Fatalf("re-seed: %v", err)
	}
	if again != 0 {
		t.Fatalf("re-seed inserted %d, want 0", again)
	}

	list, _ := s.List(ctx, uid)
	if len(list) != len(builtinExercises) {
		t.Fatalf("listed %d, want %d", len(list), len(builtinExercises))
	}
	for _, e := range list {
		if !e.IsBuiltin {
			t.Fatalf("seeded exercise %q should be built-in", e.Name)
		}
	}
}
