import { createGraniteClient, type GraniteClient } from '@granite/shared';

/**
 * Builds a Granite API client from the environment:
 *   GRANITE_URL    base URL of the Granite server (default http://localhost:8080)
 *   GRANITE_TOKEN  a personal API token (gra_...), required
 * The token is attached as a Bearer credential on every request.
 */
export function createClient(): GraniteClient {
	const url = process.env.GRANITE_URL ?? 'http://localhost:8080';
	const token = process.env.GRANITE_TOKEN;
	if (!token) {
		throw new Error('GRANITE_TOKEN is required (create a personal API token in Granite).');
	}
	const client = createGraniteClient(url);
	client.use({
		onRequest({ request }) {
			request.headers.set('Authorization', `Bearer ${token}`);
			return request;
		}
	});
	return client;
}
