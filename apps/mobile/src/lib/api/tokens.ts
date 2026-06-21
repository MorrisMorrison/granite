const ACCESS = 'granite.access';
const REFRESH = 'granite.refresh';

/** Token storage. (localStorage for now; a later slice moves to a more secure
 *  store. Silent refresh-on-401 lives in client.ts.) */
export const tokens = {
	access(): string | null {
		return typeof localStorage !== 'undefined' ? localStorage.getItem(ACCESS) : null;
	},
	refresh(): string | null {
		return typeof localStorage !== 'undefined' ? localStorage.getItem(REFRESH) : null;
	},
	set(access: string, refresh: string): void {
		localStorage.setItem(ACCESS, access);
		localStorage.setItem(REFRESH, refresh);
	},
	clear(): void {
		localStorage.removeItem(ACCESS);
		localStorage.removeItem(REFRESH);
	}
};
