// Command gen-openapi prints the generated OpenAPI spec (YAML) to stdout. It
// builds the server with nil dependencies — only the route/type registrations
// matter for spec generation, never the handlers.
package main

import (
	"fmt"
	"os"

	"github.com/MorrisMorrison/granite/apps/api/internal/server"
)

func main() {
	srv := server.New(nil, nil, nil, nil, nil, nil, []string{"*"})
	spec, err := srv.OpenAPIYAML()
	if err != nil {
		fmt.Fprintln(os.Stderr, "gen-openapi:", err)
		os.Exit(1)
	}
	if _, err := os.Stdout.Write(spec); err != nil {
		fmt.Fprintln(os.Stderr, "gen-openapi:", err)
		os.Exit(1)
	}
}
