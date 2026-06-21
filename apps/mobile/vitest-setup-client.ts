import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';

// Unmount components between tests so the jsdom document stays clean.
afterEach(() => cleanup());
