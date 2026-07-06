import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearDraft, loadDraft, saveDraft, type WorkoutDraft } from './workoutDraft';

// This test runs in the node (server) project, which has no localStorage.
// Install a minimal in-memory shim so the module under test behaves as in a browser.
function installLocalStorage(): void {
	const store = new Map<string, string>();
	(globalThis as { localStorage?: unknown }).localStorage = {
		getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
		setItem: (k: string, v: string) => void store.set(k, String(v)),
		removeItem: (k: string) => void store.delete(k),
		clear: () => store.clear()
	};
}

function draft(overrides: Partial<WorkoutDraft> = {}): WorkoutDraft {
	return {
		title: 'Push A',
		notes: 'felt strong',
		startTime: 1_700_000_000_000,
		fromRoutineId: 'routine-1',
		exercises: [
			{
				uid: 'ex-1',
				exercise_id: 'bench',
				name: 'Bench Press',
				notes: 'controlled',
				rest_seconds: 120,
				sets: [{ uid: 's-1', set_type: 'normal', weight: 100, reps: 5, is_completed: true }]
			}
		],
		...overrides
	};
}

describe('workoutDraft', () => {
	beforeEach(() => installLocalStorage());
	afterEach(() => localStorage.clear());

	it('round-trips save → load', () => {
		const d = draft();
		saveDraft(d);
		expect(loadDraft()).toEqual(d);
	});

	it('returns null when nothing is stored', () => {
		expect(loadDraft()).toBeNull();
	});

	it('clearDraft removes the persisted draft', () => {
		saveDraft(draft());
		clearDraft();
		expect(loadDraft()).toBeNull();
	});

	it('does not persist an empty draft (no exercises)', () => {
		saveDraft(draft({ exercises: [] }));
		expect(loadDraft()).toBeNull();
	});

	it('saving an empty draft clears a previously stored one', () => {
		saveDraft(draft());
		saveDraft(draft({ exercises: [] }));
		expect(loadDraft()).toBeNull();
	});

	it('returns null for corrupt stored data', () => {
		localStorage.setItem('granite.workoutDraft', '{not valid json');
		expect(loadDraft()).toBeNull();
	});
});
