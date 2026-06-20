package config

import (
	"strings"
	"testing"
)

func TestLoadMissingSecret(t *testing.T) {
	t.Setenv("GRANITE_JWT_SECRET", "")
	if _, err := Load(); err == nil {
		t.Fatal("expected an error when GRANITE_JWT_SECRET is unset")
	}
}

func TestLoadRejectsWeakSecret(t *testing.T) {
	t.Setenv("GRANITE_JWT_SECRET", "too-short")
	if _, err := Load(); err == nil {
		t.Fatal("expected an error for a secret shorter than 32 bytes")
	}
}

func TestLoadDefaults(t *testing.T) {
	t.Setenv("GRANITE_JWT_SECRET", strings.Repeat("x", 32))
	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.AllowRegistration {
		t.Error("AllowRegistration should default to false (closed)")
	}
	if cfg.Port != "8080" {
		t.Errorf("Port default = %q, want 8080", cfg.Port)
	}
}
