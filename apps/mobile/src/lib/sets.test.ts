import { describe, expect, it } from 'vitest';

import { setBadge, setLabel } from './sets';

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

describe('setBadge', () => {
	it('uses W/D/F letters and numbers the rest, skipping warm-ups', () => {
		const sets = [
			{ set_type: 'warmup' },
			{ set_type: 'normal' },
			{ set_type: 'drop' },
			{ set_type: 'failure' },
			{ set_type: 'top' }
		];
		expect(sets.map((_, i) => setBadge(sets, i))).toEqual(['W', '1', 'D', 'F', '4']);
	});
});
