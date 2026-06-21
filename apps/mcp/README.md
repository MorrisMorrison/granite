# @granite/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for Granite. It exposes your Granite
data to MCP clients (Claude Desktop, etc.), talking to a Granite instance over its REST API with a
personal API token. **Read-only by default; write tools are opt-in.**

## Tools

### Read (always available)

| Tool | What it does |
|------|--------------|
| `whoami` | The authenticated Granite user |
| `list_exercises` | Exercises (your custom ones + built-ins), optional name filter |
| `get_exercise` | One exercise by id |
| `list_routines` | Your routines |
| `get_routine` | One routine, with its exercises + target sets |
| `list_workouts` | Your logged workouts (most recent first) |
| `get_workout` | One logged workout, with exercises + performed sets |

### Write (opt-in)

Registered only when `GRANITE_ALLOW_WRITE=true`. **Double-gated:** the API independently requires the
token to have **write** scope, so a read-only token still gets a `403` even if these are enabled.

| Tool | What it does |
|------|--------------|
| `log_workout` | Log a completed workout (title, optional routine_id/times, exercises + performed sets) |
| `create_routine` | Create a routine template (title, optional folder, exercises + target sets) |

## Setup

1. Create a personal API token in Granite (`POST /api/v1/tokens`, from a logged-in session).
2. Build it: `pnpm --filter @granite/mcp build` (produces `dist/index.js`).
3. Point your MCP client at it:

```json
{
  "mcpServers": {
    "granite": {
      "command": "node",
      "args": ["/absolute/path/to/granite/apps/mcp/dist/index.js"],
      "env": {
        "GRANITE_URL": "https://granite.example.com",
        "GRANITE_TOKEN": "gra_xxxxxxxx..."
      }
    }
  }
}
```

| Env var | Default | Notes |
|---------|---------|-------|
| `GRANITE_URL` | `http://localhost:8080` | Base URL of your Granite server |
| `GRANITE_TOKEN` | — | **Required.** A personal API token (`gra_…`) |
| `GRANITE_ALLOW_WRITE` | `false` | Set `true`/`1`/`yes` to register the write tools. The token must also have write scope. |

The server speaks MCP over **stdio**; logs go to stderr (stdout is the protocol channel).
