// Pure conversion of a Hevy CSV workout-history export into a Granite import
// envelope (the same shape POSTed to /api/v1/import). No storage/UI/network
// imports — trivially unit-testable. The Settings screen is a thin layer over
// buildHevyImport(): read the file, pass the live exercise library, POST, resync.
//
// The CSV is one row per set. Rows are grouped by (title + start_time) into
// workouts, then by (exercise_title + superset_id) into exercises, then each row
// becomes a set. Exercise names are mapped to Granite built-ins via exact (case-
// insensitive) name match, then an alias table; anything still unmatched becomes
// a custom exercise. All ids are derived deterministically from the source data,
// so re-importing the same file upserts in place instead of duplicating.

export interface LibraryExercise {
	id: string;
	name: string;
}

interface DumpExercise {
	id: string;
	name: string;
	exercise_type: string;
	primary_muscle: string;
	secondary_muscles: string[];
	equipment: string;
	instructions: string;
	is_archived: boolean;
	is_builtin: boolean;
	created_at: number;
	updated_at: number;
}

interface DumpSet {
	id: string;
	order_index: number;
	set_type: string;
	weight: number | null;
	reps: number | null;
	rpe: number | null;
	duration: number | null;
	distance: number | null;
	is_completed: boolean;
}

interface DumpExerciseEntry {
	id: string;
	exercise_id: string;
	order_index: number;
	notes: string;
	superset_group: number | null;
	sets: DumpSet[];
}

interface DumpWorkout {
	id: string;
	routine_id: null;
	title: string;
	notes: string;
	start_time: number;
	end_time: number | null;
	exercises: DumpExerciseEntry[];
	created_at: number;
	updated_at: number;
}

export interface HevyImportEnvelope {
	exercises: DumpExercise[];
	routine_folders: [];
	routines: [];
	workouts: DumpWorkout[];
	bodyweight: [];
}

export interface HevyImportResult {
	envelope: HevyImportEnvelope;
	workoutCount: number;
	setCount: number;
	matchedExercises: string[]; // distinct Hevy titles mapped to existing library exercises
	customExercises: string[]; // distinct Hevy titles created as new custom exercises
}

// Hevy exercise title → Granite built-in name. Exact (case-insensitive) matches
// are tried first, so only renames need an entry here.
const HEVY_ALIASES: Record<string, string> = {
	'Bench Press (Barbell)': 'Barbell Bench Press',
	'Squat (Barbell)': 'Barbell Back Squat',
	'Deadlift (Barbell)': 'Conventional Deadlift',
	'Bent Over Row (Barbell)': 'Barbell Row',
	'Pendlay Row (Barbell)': 'Pendlay Row',
	'Overhead Press (Barbell)': 'Overhead Press',
	'Bicep Curl (Barbell)': 'Barbell Curl',
	'Bicep Curl (Dumbbell)': 'Dumbbell Bicep Curl',
	'Lateral Raise (Dumbbell)': 'Lateral Raise',
	'Pull Up (Weighted)': 'Pull Up',
	'Chin Up (Weighted)': 'Chin Up',
	'Triceps Dip (Weighted)': 'Dip',
	'Triceps Rope Pushdown': 'Rope Pushdown',
	Skullcrushers: 'Skullcrusher',
	'Good Morning (Barbell)': 'Good Morning'
};

// Set types Granite understands; anything else falls back to 'normal'.
const KNOWN_SET_TYPES = new Set(['normal', 'warmup', 'top', 'backoff', 'drop', 'failure']);

/** Parse RFC-4180-ish CSV text into rows of fields (handles quotes, "" escapes, CRLF, commas/newlines inside quotes). */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;
	// Strip a UTF-8 BOM if present.
	if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (inQuotes) {
			if (c === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += c;
			}
		} else if (c === '"') {
			inQuotes = true;
		} else if (c === ',') {
			row.push(field);
			field = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && text[i + 1] === '\n') i++;
			row.push(field);
			field = '';
			rows.push(row);
			row = [];
		} else {
			field += c;
		}
	}
	// Flush a trailing field/row that didn't end in a newline.
	if (field !== '' || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

// FNV-1a 32-bit hash → base36, for stable ids derived from source data.
function hash(s: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(36);
}

function num(s: string | undefined): number | null {
	if (s == null) return null;
	const t = s.trim();
	if (t === '') return null;
	const n = Number(t);
	return Number.isFinite(n) ? n : null;
}

function parseDate(s: string): number {
	const t = (s ?? '').trim();
	if (!t) return 0;
	const ms = new Date(t).getTime();
	return Number.isFinite(ms) ? ms : 0;
}

/**
 * Convert Hevy CSV text into a Granite import envelope, mapping exercises against
 * the given library (built-ins + the user's existing customs). `now` stamps the
 * created/updated time on newly-created custom exercises.
 */
export function buildHevyImport(
	csv: string,
	library: LibraryExercise[],
	now: number = Date.now()
): HevyImportResult {
	const rows = parseCsv(csv);
	if (rows.length < 2) {
		return {
			envelope: { exercises: [], routine_folders: [], routines: [], workouts: [], bodyweight: [] },
			workoutCount: 0,
			setCount: 0,
			matchedExercises: [],
			customExercises: []
		};
	}

	const header = rows[0].map((h) => h.trim());
	const col = (name: string) => header.indexOf(name);
	const iTitle = col('title');
	const iStart = col('start_time');
	const iEnd = col('end_time');
	const iExTitle = col('exercise_title');
	const iSuperset = col('superset_id');
	const iExNotes = col('exercise_notes');
	const iSetType = col('set_type');
	const iWeight = col('weight_kg');
	const iReps = col('reps');
	const iDistance = col('distance_km');
	const iDuration = col('duration_seconds');
	const iRpe = col('rpe');

	const byName = new Map<string, string>();
	for (const e of library) byName.set(e.name.trim().toLowerCase(), e.id);

	const customById = new Map<string, DumpExercise>();
	const matched = new Set<string>();
	const customTitles = new Set<string>();
	const resolved = new Map<string, string>(); // title → exercise id (decided once)

	// Resolve a Hevy title to a Granite exercise id, creating a custom on demand.
	function resolveExerciseId(rawTitle: string): string {
		const title = rawTitle.trim();
		const cached = resolved.get(title);
		if (cached) return cached;

		const target = HEVY_ALIASES[title] ?? title;
		const existing = byName.get(target.toLowerCase());
		let id: string;
		if (existing) {
			matched.add(title);
			id = existing;
		} else {
			// New custom exercise — stable id from the resolved name so repeated imports
			// (and other titles aliasing to the same name) share one exercise.
			id = 'hevy-ex-' + hash(target.toLowerCase());
			if (!customById.has(id)) {
				customById.set(id, {
					id,
					name: target,
					exercise_type: 'weight_reps',
					primary_muscle: '',
					secondary_muscles: [],
					equipment: '',
					instructions: '',
					is_archived: false,
					is_builtin: false,
					created_at: now,
					updated_at: now
				});
			}
			customTitles.add(title);
		}
		resolved.set(title, id);
		return id;
	}

	const workouts = new Map<string, DumpWorkout>();
	// entryKey → entry, scoped per workout so the same lift in two sessions stays separate.
	const entries = new Map<string, DumpExerciseEntry>();
	let setCount = 0;

	for (let r = 1; r < rows.length; r++) {
		const cells = rows[r];
		if (cells.length === 1 && cells[0].trim() === '') continue; // blank line
		const exTitle = (cells[iExTitle] ?? '').trim();
		if (!exTitle) continue;

		const weight = num(cells[iWeight]);
		const reps = num(cells[iReps]);
		const duration = num(cells[iDuration]);
		const distance = num(cells[iDistance]);
		if (weight === null && reps === null && duration === null && distance === null) continue;

		const wTitle = (cells[iTitle] ?? '').trim() || 'Workout';
		const startRaw = (cells[iStart] ?? '').trim();
		const wKey = wTitle + '|' + startRaw;
		let workout = workouts.get(wKey);
		if (!workout) {
			const start = parseDate(startRaw);
			workout = {
				id: 'hevy-w-' + hash(wKey),
				routine_id: null,
				title: wTitle,
				notes: '',
				start_time: start,
				end_time: iEnd >= 0 ? parseDate(cells[iEnd]) || null : null,
				exercises: [],
				created_at: start || now,
				updated_at: start || now
			};
			workouts.set(wKey, workout);
		}

		const supersetRaw = iSuperset >= 0 ? (cells[iSuperset] ?? '').trim() : '';
		const eKey = wKey + '||' + exTitle + '|' + supersetRaw;
		let entry = entries.get(eKey);
		if (!entry) {
			entry = {
				id: 'hevy-we-' + hash(eKey),
				exercise_id: resolveExerciseId(exTitle),
				order_index: workout.exercises.length,
				notes: iExNotes >= 0 ? (cells[iExNotes] ?? '').trim() : '',
				superset_group: num(supersetRaw),
				sets: []
			};
			workout.exercises.push(entry);
			entries.set(eKey, entry);
		}

		let setType = (iSetType >= 0 ? cells[iSetType] ?? '' : '').trim().toLowerCase();
		if (!KNOWN_SET_TYPES.has(setType)) setType = 'normal';
		entry.sets.push({
			id: 'hevy-s-' + hash(eKey + '#' + entry.sets.length),
			order_index: entry.sets.length,
			set_type: setType,
			weight,
			reps: reps === null ? null : Math.round(reps),
			rpe: iRpe >= 0 ? num(cells[iRpe]) : null,
			duration: duration === null ? null : Math.round(duration),
			distance,
			is_completed: true
		});
		setCount++;
	}

	return {
		envelope: {
			exercises: [...customById.values()],
			routine_folders: [],
			routines: [],
			workouts: [...workouts.values()],
			bodyweight: []
		},
		workoutCount: workouts.size,
		setCount,
		matchedExercises: [...matched].sort(),
		customExercises: [...customTitles].sort()
	};
}
