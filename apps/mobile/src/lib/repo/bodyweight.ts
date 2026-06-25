import { localStore } from '$lib/local/store';
import { syncNow } from '$lib/sync';
import type { Change } from '@granite/shared';

export interface BodyweightEntry {
	id: string;
	weight: number; // kg, as stored
	recorded_at: number; // epoch ms
}

/** Weigh-ins from the local store, most recent first (works offline). */
export async function listBodyweight(): Promise<BodyweightEntry[]> {
	const records = await localStore.list('bodyweight');
	return records
		.map((c) => {
			const d = c.data as { weight?: number; recorded_at?: number };
			return { id: c.id, weight: d.weight ?? 0, recorded_at: d.recorded_at ?? 0 };
		})
		.sort((a, b) => b.recorded_at - a.recorded_at);
}

/** The weigh-in closest to a given time, or null if none. Used to annotate workouts. */
export async function nearestBodyweight(at: number): Promise<BodyweightEntry | null> {
	const all = await listBodyweight();
	if (all.length === 0) return null;
	return all.reduce((best, e) =>
		Math.abs(e.recorded_at - at) < Math.abs(best.recorded_at - at) ? e : best
	);
}

/** Record a weigh-in (weight in kg). Saves locally + syncs. */
export async function addBodyweight(weight: number, recordedAt = Date.now()): Promise<string> {
	const now = Date.now();
	const id = crypto.randomUUID();
	const change: Change = {
		entity: 'bodyweight',
		id,
		updated_at: now,
		deleted: false,
		data: { weight, recorded_at: recordedAt, created_at: now }
	};
	await localStore.localWrite(change);
	void syncNow().catch(() => {});
	return id;
}

/** Soft-delete a weigh-in. */
export async function deleteBodyweight(id: string): Promise<void> {
	const now = Date.now();
	const change: Change = { entity: 'bodyweight', id, updated_at: now, deleted: true, data: {} };
	await localStore.localWrite(change);
	void syncNow().catch(() => {});
}
