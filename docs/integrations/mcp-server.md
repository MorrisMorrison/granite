# MCP server

The Granite [MCP](https://modelcontextprotocol.io) server lets AI tools such as Claude Desktop read your workouts and routines. It runs on your own computer as a separate program and talks to your Granite server with an [API token](api-tokens.md). It's read-only unless you turn on write tools.

## Set it up

You need Node.js and pnpm, because the server is currently built from source.

1. Create an [API token](api-tokens.md).
2. Clone the repository and build the server:

   ```sh
   git clone https://github.com/MorrisMorrison/granite.git
   cd granite
   corepack pnpm install
   corepack pnpm --filter @granite/mcp build
   ```

3. Add it to your MCP client's config, using the full path to your clone:

   ```json
   {
     "mcpServers": {
       "granite": {
         "command": "node",
         "args": ["/absolute/path/to/granite/apps/mcp/dist/index.js"],
         "env": {
           "GRANITE_URL": "https://granite.example.com",
           "GRANITE_TOKEN": "gra_your_token"
         }
       }
     }
   }
   ```

## Settings

| Variable | Default | Description |
|---|---|---|
| `GRANITE_URL` | `http://localhost:8080` | The address of your Granite server. |
| `GRANITE_TOKEN` | None | Required. Your API token. |
| `GRANITE_ALLOW_WRITE` | `false` | Set to `true` to add the write tools. |

## Tools

**Read tools** are always available:

| Tool | What it does |
|---|---|
| `whoami` | Shows the signed-in user. |
| `list_exercises`, `get_exercise` | Your custom exercises and the built-in library. |
| `list_routines`, `get_routine` | Your routines, with exercises and target sets. |
| `list_workouts`, `get_workout` | Your logged workouts, most recent first. |

**Write tools** need `GRANITE_ALLOW_WRITE=true` and a token with write access:

| Tool | What it does |
|---|---|
| `log_workout` | Logs a completed workout. |
| `create_routine` | Creates a routine. |
| `update_routine` | Replaces a routine. |
| `create_folder` | Creates a routine folder. |
