// Package config loads runtime configuration from environment variables.
package config

import (
	"fmt"
	"os"
	"strconv"
)

// minJWTSecretLen is the minimum acceptable length (bytes) for the JWT secret.
// A weak secret lets an attacker forge tokens offline, so we hard-fail below it.
const minJWTSecretLen = 32

// DefaultAuthRateLimit is the per-IP request budget per minute on /api/v1/auth/*
// (brute-force defense).
const DefaultAuthRateLimit = 30

// Config holds all runtime settings for the Granite API.
type Config struct {
	Port              string
	DBPath            string
	JWTSecret         string
	BaseURL           string
	AllowRegistration bool
	// TrustedProxy enables middleware.RealIP, which rewrites RemoteAddr from the
	// client-supplied X-Forwarded-For/X-Real-IP headers. Only enable it when the
	// instance runs behind a trusted proxy that replaces those headers; otherwise
	// an attacker could spoof them to evade the per-IP rate limiter.
	TrustedProxy bool
	// AuthRateLimit is the per-IP requests/minute allowed on the auth endpoints.
	// Only the e2e suite raises it (every spec registers from 127.0.0.1); keep the
	// default in production.
	AuthRateLimit int
	LogLevel      string
	// Env is "prod" (default) or "dev". In dev the server auto-seeds the demo
	// account on startup; see GRANITE_ENV in docs/DEVELOPMENT.md.
	Env string
}

// IsDev reports whether the app is running in the development environment.
func (c Config) IsDev() bool { return c.Env == "dev" }

// Load reads configuration from the environment, applying defaults. It returns
// an error if the JWT secret is missing or too weak, or a numeric setting is invalid.
func Load() (Config, error) {
	c := Config{
		Port:      getenv("PORT", "8080"),
		DBPath:    getenv("GRANITE_DB_PATH", "granite.db"),
		JWTSecret: os.Getenv("GRANITE_JWT_SECRET"),
		BaseURL:   getenv("GRANITE_BASE_URL", "http://localhost:8080"),
		// Default closed: a fresh instance still lets the first account bootstrap
		// (see auth.Service.Register), but an exposed instance won't accept
		// arbitrary signups unless this is explicitly enabled.
		AllowRegistration: getbool("GRANITE_ALLOW_REGISTRATION", false),
		TrustedProxy:      getbool("GRANITE_TRUSTED_PROXY", false),
		LogLevel:          getenv("GRANITE_LOG_LEVEL", "info"),
		Env:               getenv("GRANITE_ENV", "prod"),
	}
	limit, err := getpositiveint("GRANITE_AUTH_RATE_LIMIT", DefaultAuthRateLimit)
	if err != nil {
		return c, err
	}
	c.AuthRateLimit = limit
	if c.JWTSecret == "" {
		return c, fmt.Errorf("GRANITE_JWT_SECRET is required")
	}
	if len(c.JWTSecret) < minJWTSecretLen {
		return c, fmt.Errorf("GRANITE_JWT_SECRET must be at least %d bytes (generate with: openssl rand -base64 48)", minJWTSecretLen)
	}
	return c, nil
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getbool(key string, def bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return def
	}
	return b
}

// getpositiveint parses a positive integer, erroring rather than silently falling
// back so a typo in a security-relevant limit is caught at startup.
func getpositiveint(key string, def int) (int, error) {
	v := os.Getenv(key)
	if v == "" {
		return def, nil
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return 0, fmt.Errorf("%s must be a positive integer, got %q", key, v)
	}
	return n, nil
}
