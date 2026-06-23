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

// Config holds all runtime settings for the Granite API.
type Config struct {
	Port              string
	DBPath            string
	JWTSecret         string
	BaseURL           string
	AllowRegistration bool
	LogLevel          string
	// Env is "prod" (default) or "dev". In dev the server auto-seeds the demo
	// account on startup; see GRANITE_ENV in docs/DEVELOPMENT.md.
	Env string
}

// IsDev reports whether the app is running in the development environment.
func (c Config) IsDev() bool { return c.Env == "dev" }

// Load reads configuration from the environment, applying defaults. It returns
// an error if the JWT secret is missing or too weak.
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
		LogLevel:          getenv("GRANITE_LOG_LEVEL", "info"),
		Env:               getenv("GRANITE_ENV", "prod"),
	}
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
