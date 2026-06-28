// Generates the Starlight content from the repo's /docs Markdown — the docs stay the
// single source of truth (clean, GitHub-readable). For each file we derive a title
// from its first H1, add Starlight frontmatter, and rewrite cross-links to site routes
// (or GitHub for files outside /docs). Output dirs are gitignored.
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..'); // apps/docs
const repoRoot = resolve(root, '../..');
const docsSrc = join(repoRoot, 'docs');
const contentDir = join(root, 'src', 'content', 'docs');
const guidesDir = join(contentDir, 'guides');

const GH = 'https://github.com/MorrisMorrison/granite/blob/main';
const BASE = process.env.DOCS_BASE ?? '/granite';

// Files kept in the repo but NOT published to the docs site: the catalog README
// (Starlight provides navigation) and the MVP-scope planning checklist (a historical
// artifact — everything shipped; the roadmap is the live view).
const SKIP = new Set(['README.md', '01-mvp-scope.md']);

function guideSlug(file) {
	return file.replace(/\.md$/i, '').replace(/^\d+-/, '').toLowerCase();
}
function titleFromH1(md, fallback) {
	const m = md.match(/^#\s+(.+)$/m);
	return m ? m[1].replace(/^\d+\s*[—–-]\s*/, '').trim() : fallback;
}
function stripFirstH1(md) {
	return md.replace(/^#\s+.+\r?\n+/m, '');
}
const yaml = (s) => `"${s.replace(/"/g, '\\"')}"`;

// Rewrite each relative link target, resolved against the source file's own
// directory: links to other docs become site routes; links outside /docs become
// GitHub "blob/main" links. Absolute URLs and anchors are left untouched.
function rewriteLinks(md, fileDir) {
	return md.replace(/\]\(([^)\s]+)\)/g, (full, target) => {
		if (/^(https?:|mailto:|#|\/)/i.test(target)) return full;
		const hash = target.search(/[#?]/);
		const path = hash === -1 ? target : target.slice(0, hash);
		const suffix = hash === -1 ? '' : target.slice(hash);
		if (!path) return full;

		const abs = resolve(fileDir, path);
		const underDocs = abs === docsSrc || abs.startsWith(docsSrc + sep);

		if (underDocs && /\.md$/i.test(abs)) {
			const rel = relative(docsSrc, abs).replace(/\\/g, '/');
			// ADRs and the MVP-scope doc live in the repo but aren't published to the
			// site (see SKIP / the dropped decisions loop) → link to GitHub, not a dead
			// site route.
			if (rel.startsWith('decisions/') || rel === '01-mvp-scope.md') {
				return `](${GH}/docs/${rel}${suffix})`;
			}
			return `](${BASE}/guides/${guideSlug(basename(rel))}/${suffix})`;
		}
		if (underDocs && relative(docsSrc, abs).replace(/\\/g, '/') === 'decisions') {
			return `](${GH}/docs/decisions/${suffix})`;
		}
		// Outside /docs (code, deploy assets, README, …) → link to the repo on GitHub.
		return `](${GH}/${relative(repoRoot, abs).replace(/\\/g, '/')}${suffix})`;
	});
}

function emit(srcFile, destDir, { slug, title, order }) {
	const raw = readFileSync(srcFile, 'utf8');
	const body = rewriteLinks(stripFirstH1(raw), dirname(srcFile));
	const fm = `---\ntitle: ${yaml(title)}\nsidebar:\n  order: ${order}\n---\n\n`;
	writeFileSync(join(destDir, `${slug}.md`), fm + body);
}

// ADRs are intentionally NOT published — clear any previously-generated output so a
// stale decisions collection can't linger in the site build.
rmSync(guidesDir, { recursive: true, force: true });
rmSync(join(contentDir, 'decisions'), { recursive: true, force: true });
mkdirSync(guidesDir, { recursive: true });

let guides = 0;
for (const file of readdirSync(docsSrc).filter((f) => f.endsWith('.md') && !SKIP.has(f))) {
	const numMatch = file.match(/^(\d+)-/);
	const order = file === 'DEVELOPMENT.md' ? 50 : numMatch ? Number(numMatch[1]) : 99;
	const title = titleFromH1(readFileSync(join(docsSrc, file), 'utf8'), guideSlug(file));
	emit(join(docsSrc, file), guidesDir, { slug: guideSlug(file), title, order });
	guides++;
}

// ADRs (docs/decisions/*) are deliberately not synced to the site — they stay in the
// repo for contributors and render on GitHub; guide cross-links to them are rewritten
// to GitHub by rewriteLinks().

console.log(`[sync-docs] synced ${guides} guides (ADRs + MVP scope kept repo-only)`);
