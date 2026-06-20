import createClient from 'openapi-fetch';

import type { paths } from './schema';

/** Creates a fully-typed Granite API client bound to a server base URL. */
export function createGraniteClient(baseUrl: string) {
	return createClient<paths>({ baseUrl });
}

export type GraniteClient = ReturnType<typeof createGraniteClient>;
export type { paths } from './schema';
