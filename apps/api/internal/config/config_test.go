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
	if cfg.Env != "prod" || cfg.IsDev() {
		t.Errorf("Env default = %q, IsDev = %v; want prod / false", cfg.Env, cfg.IsDev())
	}
}

func TestLoadOverrides(t *testing.T) {
	t.Setenv("GRANITE_JWT_SECRET", strings.Repeat("x", 32))
	t.Setenv("PORT", "9999")
	t.Setenv("GRANITE_ENV", "dev")
	t.Setenv("GRANITE_ALLOW_REGISTRATION", "true")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Port != "9999" {
		t.Errorf("Port = %q, want 9999 (env override)", cfg.Port)
	}
	if !cfg.IsDev() {
		t.Error("Env=dev should be IsDev")
	}
	if !cfg.AllowRegistration {
		t.Error("GRANITE_ALLOW_REGISTRATION=true should parse to true")
	}
}

func TestLoadInvalidBoolFallsBackToDefault(t *testing.T) {
	t.Setenv("GRANITE_JWT_SECRET", strings.Repeat("x", 32))
	t.Setenv("GRANITE_ALLOW_REGISTRATION", "not-a-bool")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.AllowRegistration {
		t.Error("an unparseable bool should fall back to the default (false)")
	}
}
