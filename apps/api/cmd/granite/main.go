// Command granite starts the Granite HTTP API server.
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/MorrisMorrison/granite/apps/api/internal/server"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := server.New()
	addr := ":" + port
	log.Printf("granite api listening on %s", addr)
	if err := http.ListenAndServe(addr, srv.Handler()); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}
