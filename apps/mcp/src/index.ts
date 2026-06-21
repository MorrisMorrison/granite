import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createGraniteMcpClient } from './client.js';
import { registerTools } from './tools.js';

async function main(): Promise<void> {
	const client = createGraniteMcpClient();
	const allowWrite = /^(1|true|yes)$/i.test(process.env.GRANITE_ALLOW_WRITE ?? '');
	const server = new McpServer({ name: 'granite', version: '0.1.0' });
	registerTools(server, client, { allowWrite });
	// stdio is the protocol channel — never write logs to stdout.
	await server.connect(new StdioServerTransport());
	console.error(`granite-mcp ready (stdio)${allowWrite ? ' [write tools enabled]' : ''}`);
}

main().catch((err) => {
	console.error('granite-mcp failed to start:', err);
	process.exit(1);
});
