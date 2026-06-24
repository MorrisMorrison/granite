import { api } from '$lib/api/client';
import { tokens } from '$lib/api/tokens';
import { refreshExerciseLibrary } from '$lib/repo/exercises';
import { prefs } from '$lib/stores/prefs.svelte';
import { resetLocalData, syncNow } from '$lib/sync';

export interface CurrentUser {
	id: string;
	email: string;
	display_name: string;
}

const USER_KEY = 'granite.user';

function cacheUser(u: CurrentUser | null): void {
	if (typeof localStorage === 'undefined') return;
	if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
	else localStorage.removeItem(USER_KEY);
}

function cachedUser(): CurrentUser | null {
	if (typeof localStorage === 'undefined') return null;
	const raw = localStorage.getItem(USER_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as CurrentUser;
	} catch {
		return null;
	}
}

/** Reactive auth state (Svelte 5 runes). A single shared instance. */
class Auth {
	user = $state<CurrentUser | null>(null);
	ready = $state(false);

	get isAuthenticated(): boolean {
		return this.user !== null;
	}

	/**
	 * Restore session on app start — optimistic and offline-friendly: with a stored
	 * token + cached identity, consider the user logged in immediately, then validate
	 * with the server in the background. Only a real 401 logs out; a network failure
	 * (offline) keeps the session so the app runs against local data.
	 */
	async init(): Promise<void> {
		if (tokens.access()) {
			this.user = cachedUser();
			void this.revalidate();
		}
		this.ready = true;
	}

	private async revalidate(): Promise<void> {
		try {
			const { data, response } = await api().GET('/api/v1/me');
			if (data) {
				this.setUser({ id: data.id, email: data.email, display_name: data.display_name });
				this.bootstrap();
			} else if (response?.status === 401) {
				this.clearSession(); // token genuinely rejected (refresh also failed)
			}
			// Any other failure (offline / server down) keeps the optimistic session.
		} catch {
			// Network error — stay logged in against local data.
		}
	}

	async login(email: string, password: string): Promise<void> {
		const { data, error } = await api().POST('/api/v1/auth/login', { body: { email, password } });
		if (error || !data) throw new Error('Invalid email or password');
		tokens.set(data.access, data.refresh);
		this.setUser({ id: data.user.id, email: data.user.email, display_name: data.user.display_name });
		this.bootstrap();
	}

	async register(email: string, password: string): Promise<void> {
		const { data, error } = await api().POST('/api/v1/auth/register', { body: { email, password } });
		if (error || !data) throw new Error('Registration failed');
		tokens.set(data.access, data.refresh);
		this.setUser({ id: data.user.id, email: data.user.email, display_name: data.user.display_name });
		this.bootstrap();
	}

	async logout(): Promise<void> {
		const refresh = tokens.refresh();
		if (refresh) {
			try {
				await api().POST('/api/v1/auth/logout', { body: { refresh } });
			} catch {
				/* best-effort */
			}
		}
		this.clearSession();
		// Wipe device-local data so the next account (or a reset server) starts clean
		// instead of inheriting this session's cached records.
		await resetLocalData();
	}

	private setUser(u: CurrentUser): void {
		this.user = u;
		cacheUser(u);
	}

	private clearSession(): void {
		tokens.clear();
		cacheUser(null);
		this.user = null;
	}

	/** Background sync to populate/refresh local data. Non-blocking; offline failures
	 *  are swallowed so the app keeps running against the local store. */
	private bootstrap(): void {
		void syncNow().catch(() => {});
		void refreshExerciseLibrary().catch(() => {});
		void prefs.load().catch(() => {});
	}
}

export const auth = new Auth();
