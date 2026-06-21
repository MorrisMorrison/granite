// Package webui embeds the built SvelteKit SPA and serves it with a client-side
// routing fallback, so the single Granite binary serves both the API and the web
// app from one origin.
//
// The committed dist/ holds only a placeholder index.html so `go build` always
// works; the production Docker build copies the real SvelteKit output over it
// before compiling (see Dockerfile).
package webui

import (
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

//go:embed all:dist
var dist embed.FS

// Handler serves the embedded web app: a static file when one exists at the
// request path, otherwise index.html (so client-side routes resolve).
func Handler() http.Handler {
	sub, err := fs.Sub(dist, "dist")
	if err != nil {
		panic(err)
	}
	index, err := fs.ReadFile(sub, "index.html")
	if err != nil {
		panic(err)
	}
	fileServer := http.FileServer(http.FS(sub))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name != "" && name != "." {
			if f, err := sub.Open(name); err == nil {
				info, statErr := f.Stat()
				_ = f.Close()
				if statErr == nil && !info.IsDir() {
					fileServer.ServeHTTP(w, r)
					return
				}
			}
		}
		// A missing *asset* (a path with a file extension, e.g. a stale hashed chunk)
		// must 404 — returning the HTML shell instead makes a failed import look like a
		// successful fetch of the wrong type.
		if path.Ext(name) != "" {
			http.NotFound(w, r)
			return
		}
		// SPA fallback: hand index.html to the client router for navigations. Don't
		// cache it, so a deploy is picked up immediately (its hashed assets are cached).
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		_, _ = w.Write(index)
	})
}
