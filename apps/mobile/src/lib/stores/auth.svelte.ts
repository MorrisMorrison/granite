import { api } from '$lib/api/client';
import { tokens } from '$lib/api/tokens';

export interface CurrentUser {
	id: string;
	email: string;
	display_name: string;
}

/** Reactive auth state (Svelte 5 runes). A single shared instance. */
class Auth {
	user = $state<CurrentUser | null>(null);
	ready = $state(false);

	get isAuthenticated(): boolean {
		return this.user !== null;
	}

	/** Restore session from a stored token on app start. */
	async init(): Promise<void> {
		if (tokens.access()) {
			try {
				await this.loadMe();
			} catch {
				tokens.clear();
			}
		}
		this.ready = true;
	}

	async loadMe(): Promise<void> {
		const { data, error } = await api().GET('/api/v1/me');
		if (error || !data) throw new Error('not authenticated');
		this.user = { id: data.id, email: data.email, display_name: data.display_name };
	}

	async login(email: string, password: string): Promise<void> {
		const { data, error } = await api().POST('/api/v1/auth/login', { body: { email, password } });
		if (error || !data) throw new Error('Invalid email or password');
		tokens.set(data.access, data.refresh);
		this.user = { id: data.user.id, email: data.user.email, display_name: data.user.display_name };
	}

	async register(email: string, password: string): Promise<void> {
		const { data, error } = await api().POST('/api/v1/auth/register', { body: { email, password } });
		if (error || !data) throw new Error('Registration failed');
		tokens.set(data.access, data.refresh);
		this.user = { id: data.user.id, email: data.user.email, display_name: data.user.display_name };
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
		tokens.clear();
		this.user = null;
	}
}

export const auth = new Auth();
