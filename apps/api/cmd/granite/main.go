// Command granite starts the Granite HTTP API server.
package main

import (
	"context"
	"log"

	"github.com/MorrisMorrison/granite/apps/api/app"
)

func main() {
	if err := app.Run(context.Background(), app.Options{}); err != nil {
		log.Fatalf("granite: %v", err)
	}
}
