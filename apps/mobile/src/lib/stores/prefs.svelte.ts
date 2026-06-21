import { api } from '$lib/api/client';

export type WeightUnit = 'kg' | 'lb';

export interface Prefs {
	weightUnit: WeightUnit;
	restSeconds: number;
}

const DEFAULTS: Prefs = { weightUnit: 'kg', restSeconds: 90 };
const CACHE_KEY = 'granite.prefs';

function sanitize(raw: unknown): Partial<Prefs> {
	const s = (raw ?? {}) as Record<string, unknown>;
	const out: Partial<Prefs> = {};
	if (s.weightUnit === 'kg' || s.weightUnit === 'lb') out.weightUnit = s.weightUnit;
	if (typeof s.restSeconds === 'number' && s.restSeconds > 0 && s.restSeconds <= 3600) {
		out.restSeconds = Math.round(s.restSeconds);
	}
	return out;
}

function cached(): Prefs {
	if (typeof localStorage === 'undefined') return { ...DEFAULTS };
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (raw) return { ...DEFAULTS, ...sanitize(JSON.parse(raw)) };
	} catch {
		/* ignore corrupt cache */
	}
	return { ...DEFAULTS };
}

/**
 * User preferences (weight unit, default rest), stored in the account's synced
 * `settings` blob so they follow you across devices. Cached in localStorage so the
 * UI has them instantly + offline; hydrated from the server on auth bootstrap.
 */
class PrefsStore {
	current = $state<Prefs>(cached());

	/** Hydrate from the server's user.settings. Best-effort (keeps cache offline). */
	async load(): Promise<void> {
		try {
			const { data } = await api().GET('/api/v1/me');
			this.current = { ...DEFAULTS, ...sanitize(data?.settings) };
			this.persistLocal();
		} catch {
			/* offline — keep the cached prefs */
		}
	}

	/** Patch prefs locally (instant) + persist to the synced account settings. */
	async update(patch: Partial<Prefs>): Promise<void> {
		this.current = { ...this.current, ...patch };
		this.persistLocal();
		try {
			await api().PATCH('/api/v1/me', { body: { settings: this.current } });
		} catch {
			/* offline — the local cache holds; re-synced on next load/update */
		}
	}

	private persistLocal(): void {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(CACHE_KEY, JSON.stringify(this.current));
		}
	}
}

export const prefs = new PrefsStore();
