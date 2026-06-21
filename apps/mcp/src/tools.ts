import type { GraniteClient, paths } from '@granite/shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

type WorkoutBody = NonNullable<
	paths['/api/v1/workouts']['post']['requestBody']
>['content']['application/json'];
type RoutineBody = NonNullable<
	paths['/api/v1/routines']['post']['requestBody']
>['content']['application/json'];
type RoutineUpdateBody = NonNullable<
	paths['/api/v1/routines/{id}']['patch']['requestBody']
>['content']['application/json'];
type FolderBody = NonNullable<
	paths['/api/v1/routine-folders']['post']['requestBody']
>['content']['application/json'];

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

// --- write tool implementations (exported for unit tests) -------------------

export function logWorkout(c: GraniteClient, body: WorkoutBody) {
	return call(c.POST('/api/v1/workouts', { body }));
}

export function createRoutine(c: GraniteClient, body: RoutineBody) {
	return call(c.POST('/api/v1/routines', { body }));
}

export function updateRoutine(c: GraniteClient, id: string, body: RoutineUpdateBody) {
	return call(c.PATCH('/api/v1/routines/{id}', { params: { path: { id } }, body }));
}

export function createFolder(c: GraniteClient, body: FolderBody) {
	return call(c.POST('/api/v1/routine-folders', { body }));
}

// --- registration -----------------------------------------------------------

function textResult(data: unknown) {
	return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

// Zod shapes for the write-tool inputs (mirror the API's *Input schemas).
const workoutSetShape = z.object({
	set_type: z.string().optional(),
	weight: z.number().optional(),
	reps: z.number().int().optional(),
	rpe: z.number().optional(),
	duration: z.number().int().optional().describe('seconds, for timed sets'),
	distance: z.number().optional(),
	is_completed: z.boolean().optional()
});
const workoutExerciseShape = z.object({
	exercise_id: z.string(),
	notes: z.string().optional(),
	superset_group: z.number().int().optional(),
	sets: z.array(workoutSetShape).optional()
});
const routineSetShape = z.object({
	set_type: z.string().optional(),
	target_weight: z.number().optional(),
	target_reps: z.number().int().optional(),
	target_rpe: z.number().optional(),
	target_duration: z.number().int().optional().describe('seconds, for timed sets')
});
const routineExerciseShape = z.object({
	exercise_id: z.string(),
	notes: z.string().optional(),
	rest_seconds: z.number().int().optional(),
	superset_group: z.number().int().optional(),
	sets: z.array(routineSetShape).optional()
});

/**
 * Registers Granite's tools on the MCP server. Read tools are always registered;
 * write tools are added only when `allowWrite` is set (the GRANITE_ALLOW_WRITE
 * opt-in) — and the API still independently requires the token to have write scope.
 */
export function registerTools(
	server: McpServer,
	c: GraniteClient,
	opts: { allowWrite?: boolean } = {}
): void {
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

	if (!opts.allowWrite) return;

	// --- write tools (opt-in via GRANITE_ALLOW_WRITE; the token must also have write scope) ---

	server.tool(
		'log_workout',
		'Log a completed workout. Requires GRANITE_ALLOW_WRITE=true and a write-scoped token.',
		{
			title: z.string().optional(),
			notes: z.string().optional(),
			routine_id: z.string().optional().describe('id of the routine this workout came from'),
			start_time: z.number().int().optional().describe('epoch ms; server uses now if omitted'),
			end_time: z.number().int().optional().describe('epoch ms'),
			exercises: z.array(workoutExerciseShape).describe('exercises performed, with their sets')
		},
		async (args) => textResult(await logWorkout(c, args))
	);

	server.tool(
		'create_routine',
		'Create a routine (a reusable template). Requires GRANITE_ALLOW_WRITE=true and a write-scoped token.',
		{
			title: z.string(),
			notes: z.string().optional(),
			folder_id: z.string().optional(),
			exercises: z.array(routineExerciseShape).optional().describe('exercises with target sets')
		},
		async (args) => textResult(await createRoutine(c, args))
	);

	server.tool(
		'update_routine',
		'Replace a routine by id (title + exercises/sets are overwritten). Requires GRANITE_ALLOW_WRITE=true and a write-scoped token.',
		{
			id: z.string(),
			title: z.string(),
			notes: z.string().optional(),
			folder_id: z.string().optional(),
			exercises: z.array(routineExerciseShape).optional().describe('the new full set of exercises')
		},
		async ({ id, ...body }) => textResult(await updateRoutine(c, id, body))
	);

	server.tool(
		'create_folder',
		'Create a routine folder. Requires GRANITE_ALLOW_WRITE=true and a write-scoped token.',
		{
			name: z.string(),
			order_index: z.number().int().optional()
		},
		async (args) => textResult(await createFolder(c, args))
	);
}
