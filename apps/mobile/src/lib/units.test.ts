import { describe, expect, it } from 'vitest';
import { displayToKg, kgToDisplay } from './units';

describe('units', () => {
	it('kg passes through unchanged', () => {
		expect(kgToDisplay(60, 'kg')).toBe(60);
		expect(displayToKg(60, 'kg')).toBe(60);
	});

	it('converts kg <-> lb for display', () => {
		expect(kgToDisplay(100, 'lb')).toBeCloseTo(220.46, 1);
		expect(displayToKg(220.46, 'lb')).toBeCloseTo(100, 1);
	});

	it('round-trips a typical barbell load within rounding', () => {
		const shown = kgToDisplay(60, 'lb')!; // ~132.28 lb
		expect(displayToKg(shown, 'lb')).toBeCloseTo(60, 2);
	});

	it('passes null through', () => {
		expect(kgToDisplay(null, 'lb')).toBeNull();
		expect(displayToKg(null, 'kg')).toBeNull();
	});
});
