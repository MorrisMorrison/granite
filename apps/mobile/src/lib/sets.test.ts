import { describe, expect, it } from 'vitest';

import { setLabel } from './sets';

describe('setLabel', () => {
	it('labels warm-ups "W" and numbers work sets, skipping warm-ups', () => {
		const sets = [
			{ set_type: 'warmup' },
			{ set_type: 'warmup' },
			{ set_type: 'normal' },
			{ set_type: 'top' },
			{ set_type: 'backoff' }
		];
		expect(sets.map((_, i) => setLabel(sets, i))).toEqual(['W', 'W', '1', '2', '3']);
	});

	it('counts only work sets when warm-ups are interleaved', () => {
		const sets = [{ set_type: 'normal' }, { set_type: 'warmup' }, { set_type: 'normal' }];
		expect(sets.map((_, i) => setLabel(sets, i))).toEqual(['1', 'W', '2']);
	});
});
