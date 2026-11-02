// Generates the Starlight content from the repo's /docs Markdown — the docs stay the
// single source of truth (clean, GitHub-readable). Each section folder maps to a site
// section with the same path. For each file we derive a title from its first H1, add
// Starlight frontmatter, and rewrite cross-links to site routes (or GitHub for files
// outside the published sections). Output dirs are gitignored.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..'); // apps/docs
const repoRoot = resolve(root, '../..');
const docsSrc = join(repoRoot, 'docs');
const contentDir = join(root, 'src', 'content', 'docs');

const REPO = 'https://github.com/MorrisMorrison/granite';
const GH = `${REPO}/blob/main`;
const EDIT = `${REPO}/edit/main`;
const BASE = process.env.DOCS_BASE ?? '/granite';

// The published sections, in /docs and on the site. ADRs and working notes stay repo-only.
const SECTIONS = ['getting-started', 'user-guide', 'self-hosting', 'integrations', 'project', 'technical'];
// Kept in the repo but not published: a historical planning checklist (everything
// shipped; the roadmap is the live view).
const SKIP = new Set(['technical/mvp-scope.md']);

const toPosix = (p) => p.split(sep).join('/');
const isPublished = (rel) =>
	SECTIONS.some((s) => rel.startsWith(`${s}/`)) && rel.endsWith('.md') && !SKIP.has(rel);

function titleFromH1(md, fallback) {
	const m = md.match(/^#\s+(.+)$/m);
	return m ? m[1].trim() : fallback;
}
function stripFirstH1(md) {
	return md.replace(/^#\s+.+\r?\n+/m, '');
}
const yaml = (s) => `"${s.replace(/"/g, '\\"')}"`;

// Rewrite each relative link target, resolved against the source file's own directory:
// links to published docs become site routes; everything else (ADRs, code, deploy assets,
// README) becomes a GitHub link. Absolute URLs and anchors are left untouched.
function rewriteLinks(md, fileDir) {
	return md.replace(/\]\(([^)\s]+)\)/g, (full, target) => {
		if (/^(https?:|mailto:|#|\/)/i.test(target)) return full;
		const hash = target.search(/[#?]/);
		const path = hash === -1 ? target : target.slice(0, hash);
		const suffix = hash === -1 ? '' : target.slice(hash);
		if (!path) return full;

		const abs = resolve(fileDir, path);
		const rel = toPosix(relative(docsSrc, abs));
		if (isPublished(rel)) return `](${BASE}/${rel.replace(/\.md$/i, '')}/${suffix})`;
		return `](${GH}/${toPosix(relative(repoRoot, abs))}${suffix})`;
	});
}

function emit(rel) {
	const src = join(docsSrc, rel);
	const raw = readFileSync(src, 'utf8');
	const title = titleFromH1(raw, rel);
	const body = rewriteLinks(stripFirstH1(raw), dirname(src));
	const fm = `---\ntitle: ${yaml(title)}\neditUrl: ${EDIT}/docs/${rel}\n---\n\n`;
	const dest = join(contentDir, rel);
	mkdirSync(dirname(dest), { recursive: true });
	writeFileSync(dest, fm + body);
}

let pages = 0;
for (const section of SECTIONS) {
	rmSync(join(contentDir, section), { recursive: true, force: true });
	const dir = join(docsSrc, section);
	if (!existsSync(dir)) continue;
	for (const file of readdirSync(dir)) {
		const rel = `${section}/${file}`;
		if (!isPublished(rel)) continue;
		emit(rel);
		pages++;
	}
}

console.log(`[sync-docs] synced ${pages} pages (ADRs + MVP scope kept repo-only)`);
