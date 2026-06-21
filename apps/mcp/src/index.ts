import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createClient } from './client.js';
import { registerTools } from './tools.js';

async function main(): Promise<void> {
	const client = createClient();
	const server = new McpServer({ name: 'granite', version: '0.1.0' });
	registerTools(server, client);
	// stdio is the protocol channel — never write logs to stdout.
	await server.connect(new StdioServerTransport());
	console.error('granite-mcp ready (stdio)');
}

main().catch((err) => {
	console.error('granite-mcp failed to start:', err);
	process.exit(1);
});
