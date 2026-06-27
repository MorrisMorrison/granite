package app

import (
	"testing"

	"github.com/MorrisMorrison/granite/apps/api/gate"
)

type stubGate struct{ gate.AllowAll }

func TestGateOrDefaultFallsBackToAllowAll(t *testing.T) {
	if _, ok := (Options{}).gateOrDefault().(gate.AllowAll); !ok {
		t.Fatal("nil gate should default to gate.AllowAll")
	}
}

func TestGateOrDefaultKeepsProvidedGate(t *testing.T) {
	if _, ok := (Options{Gate: stubGate{}}).gateOrDefault().(stubGate); !ok {
		t.Fatal("a provided gate should be returned unchanged")
	}
}
