// Package migrations embeds the SQL migration files so they ship inside the binary.
package migrations

import "embed"

// FS holds the goose SQL migrations.
//
//go:embed *.sql
var FS embed.FS
