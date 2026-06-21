// Boots a real Granite stack for Playwright: build the SPA -> embed it into the
// Go binary -> run that binary against a throwaway SQLite DB. This is the same
// artifact that ships (binary embedding the web build), so the e2e exercises the
// real API + offline-first client, just like the manual :8080 loop.
//
// Env knobs:
//   E2E_PORT        port to serve on (default 4321)
//   E2E_SKIP_BUILD  reuse the previous SPA+binary build (fast local re-runs)
//   GO_BIN          path to the `go` binary (default: `go` on PATH)
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const mobileDir = resolve(here, '..');
const apiDir = resolve(mobileDir, '../api');
const distDir = join(apiDir, 'internal/webui/dist');
const tmpDir = join(here, '.tmp');
const isWin = process.platform === 'win32';

const PORT = process.env.E2E_PORT ?? '4321';
const GO = process.env.GO_BIN || 'go';
const bin = join(tmpDir, isWin ? 'granite.exe' : 'granite');

function run(cmd, args, opts = {}) {
	const r = spawnSync(cmd, args, { stdio: 'inherit', shell: isWin, ...opts });
	if (r.status !== 0) {
		console.error(`[e2e] failed: ${cmd} ${args.join(' ')}`);
		process.exit(r.status ?? 1);
	}
}

mkdirSync(tmpDir, { recursive: true });

if (!process.env.E2E_SKIP_BUILD) {
	// 1) Build the SPA.
	run('corepack', ['pnpm', 'build'], { cwd: mobileDir });
	// 2) Embed it: clean dist, copy the fresh build in.
	rmSync(distDir, { recursive: true, force: true });
	mkdirSync(distDir, { recursive: true });
	cpSync(join(mobileDir, 'build'), distDir, { recursive: true });
	// 3) Build the Go binary (go:embed bakes in dist). Use a path relative to the
	// api dir for -o: the absolute project path has a space, which shell:true would
	// split into two args.
	run(GO, ['build', '-o', relative(apiDir, bin), './cmd/granite'], {
		cwd: apiDir,
		env: { ...process.env, GOTOOLCHAIN: 'auto' }
	});
}

// Fresh DB every run.
const dbPath = join(tmpDir, 'e2e.db');
for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) rmSync(f, { force: true });

const child = spawn(bin, [], {
	stdio: 'inherit',
	env: {
		...process.env,
		PORT,
		GRANITE_BASE_URL: `http://localhost:${PORT}`,
		GRANITE_DB_PATH: dbPath,
		GRANITE_JWT_SECRET: 'e2e-secret-0123456789abcdef0123456789abcdef',
		GRANITE_ALLOW_REGISTRATION: 'true'
	}
});

function shutdown() {
	try {
		child.kill();
	} catch {
		/* already gone */
	}
	process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
child.on('exit', (code) => process.exit(code ?? 0));
