import type { GraniteClient } from '@granite/shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// call unwraps an openapi-fetch result, throwing on transport/API errors.
async function call<T>(p: Promise<{ data?: T; error?: unknown }>): Promise<T> {
	const { data, error } = await p;
	if (error !== undefined && error !== null) {
		throw new Error(`Granite API error: ${JSON.stringify(error)}`);
	}
	if (data === undefined) {
		throw new Error('Granite API returned no data');
	}
	return data;
}

// --- tool implementations (exported for unit tests) -------------------------

export function getMe(c: GraniteClient) {
	return call(c.GET('/api/v1/me'));
}

export async function listExercises(c: GraniteClient, query?: string) {
	const data = await call(c.GET('/api/v1/exercises'));
	const exercises = data.exercises ?? [];
	if (!query) return exercises;
	const q = query.toLowerCase();
	return exercises.filter((e) => e.name.toLowerCase().includes(q));
}

export function getExercise(c: GraniteClient, id: string) {
	return call(c.GET('/api/v1/exercises/{id}', { params: { path: { id } } }));
}

export async function listRoutines(c: GraniteClient) {
	const data = await call(c.GET('/api/v1/routines'));
	return data.routines ?? [];
}

export function getRoutine(c: GraniteClient, id: string) {
	return call(c.GET('/api/v1/routines/{id}', { params: { path: { id } } }));
}

export async function listWorkouts(c: GraniteClient) {
	const data = await call(c.GET('/api/v1/workouts'));
	return data.workouts ?? [];
}

export function getWorkout(c: GraniteClient, id: string) {
	return call(c.GET('/api/v1/workouts/{id}', { params: { path: { id } } }));
}

// --- registration -----------------------------------------------------------

function textResult(data: unknown) {
	return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

/** Registers Granite's read-only tools on the MCP server. */
export function registerTools(server: McpServer, c: GraniteClient): void {
	server.tool('whoami', 'Get the authenticated Granite user.', async () => textResult(await getMe(c)));

	server.tool(
		'list_exercises',
		'List exercises (your custom ones + built-ins), optionally filtered by a case-insensitive name substring.',
		{ query: z.string().optional().describe('case-insensitive name filter') },
		async ({ query }) => textResult(await listExercises(c, query))
	);

	server.tool('get_exercise', 'Get one exercise by id.', { id: z.string() }, async ({ id }) =>
		textResult(await getExercise(c, id))
	);

	server.tool('list_routines', 'List your routines.', async () => textResult(await listRoutines(c)));

	server.tool(
		'get_routine',
		'Get one routine (with its exercises and target sets) by id.',
		{ id: z.string() },
		async ({ id }) => textResult(await getRoutine(c, id))
	);

	server.tool('list_workouts', 'List your logged workouts (most recent first).', async () =>
		textResult(await listWorkouts(c))
	);

	server.tool(
		'get_workout',
		'Get one logged workout (with its exercises and performed sets) by id.',
		{ id: z.string() },
		async ({ id }) => textResult(await getWorkout(c, id))
	);
}
