package gate

import (
	"context"
	"testing"
)

func TestAllowAllPermitsEverything(t *testing.T) {
	var g AccountGate = AllowAll{}
	if ok, err := g.CanRegister(context.Background(), "a@b.com"); err != nil || !ok {
		t.Fatalf("CanRegister = (%v, %v), want (true, nil)", ok, err)
	}
	if ok, err := g.CanSync(context.Background(), "user-1"); err != nil || !ok {
		t.Fatalf("CanSync = (%v, %v), want (true, nil)", ok, err)
	}
}
