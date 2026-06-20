// Package config loads runtime configuration from environment variables.
package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds all runtime settings for the Granite API.
type Config struct {
	Port              string
	DBPath            string
	JWTSecret         string
	BaseURL           string
	AllowRegistration bool
	LogLevel          string
}

// Load reads configuration from the environment, applying defaults. It returns
// an error if a required value (the JWT secret) is missing.
func Load() (Config, error) {
	c := Config{
		Port:              getenv("PORT", "8080"),
		DBPath:            getenv("GRANITE_DB_PATH", "granite.db"),
		JWTSecret:         os.Getenv("GRANITE_JWT_SECRET"),
		BaseURL:           getenv("GRANITE_BASE_URL", "http://localhost:8080"),
		AllowRegistration: getbool("GRANITE_ALLOW_REGISTRATION", true),
		LogLevel:          getenv("GRANITE_LOG_LEVEL", "info"),
	}
	if c.JWTSecret == "" {
		return c, fmt.Errorf("GRANITE_JWT_SECRET is required")
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
