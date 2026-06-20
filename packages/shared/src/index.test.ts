import { describe, expect, it } from 'vitest';
import { SHARED_PACKAGE } from './index';

describe('@granite/shared', () => {
	it('exposes a package marker', () => {
		expect(SHARED_PACKAGE).toBe('@granite/shared');
	});
});
