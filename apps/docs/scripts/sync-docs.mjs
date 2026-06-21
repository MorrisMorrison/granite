// Generates the Starlight content from the repo's /docs Markdown — the docs stay the
// single source of truth (clean, GitHub-readable). For each file we derive a title
// from its first H1, add Starlight frontmatter, and rewrite cross-links to site routes
// (or GitHub for files outside /docs). Output dirs are gitignored.
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..'); // apps/docs
const repoRoot = resolve(root, '../..');
const docsSrc = join(repoRoot, 'docs');
const contentDir = join(root, 'src', 'content', 'docs');
const guidesDir = join(contentDir, 'guides');
const decisionsDir = join(contentDir, 'decisions');

const GH = 'https://github.com/MorrisMorrison/granite/blob/main';
const BASE = process.env.DOCS_BASE ?? '/granite';

// Skip catalogs (Starlight provides navigation) and non-doc files.
const SKIP = new Set(['README.md']);

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

function rewriteLinks(md) {
	// ADR links: decisions/NNNN-name.md(#anchor) -> /base/decisions/NNNN-name/(#anchor)
	md = md.replace(
		/\]\((?:\.\/)?decisions\/(\d{4}-[a-z0-9-]+)\.md(#[\w-]+)?\)/gi,
		(_m, name, anchor) => `](${BASE}/decisions/${name.toLowerCase()}/${anchor ?? ''})`
	);
	md = md.replace(/\]\((?:\.\/)?decisions\/?\)/gi, `](${BASE}/decisions/)`);
	// Repo-relative links that leave /docs (../apps/…, ../../README.md) -> GitHub blob.
	md = md.replace(/\]\((\.\.\/[^)\s]+)\)/g, (_m, p) => {
		const rel = relative(repoRoot, resolve(docsSrc, p)).replace(/\\/g, '/');
		return `](${GH}/${rel})`;
	});
	// Sibling doc links: (NN-)name.md(#anchor) -> /base/guides/name/(#anchor)
	md = md.replace(
		/\]\((?:\.\/)?(?:\d+-)?([A-Za-z0-9-]+)\.md(#[\w-]+)?\)/g,
		(_m, name, anchor) => `](${BASE}/guides/${name.toLowerCase()}/${anchor ?? ''})`
	);
	return md;
}

function emit(srcFile, destDir, { slug, title, order }) {
	const raw = readFileSync(srcFile, 'utf8');
	const body = rewriteLinks(stripFirstH1(raw));
	const fm = `---\ntitle: ${yaml(title)}\nsidebar:\n  order: ${order}\n---\n\n`;
	writeFileSync(join(destDir, `${slug}.md`), fm + body);
}

rmSync(guidesDir, { recursive: true, force: true });
rmSync(decisionsDir, { recursive: true, force: true });
mkdirSync(guidesDir, { recursive: true });
mkdirSync(decisionsDir, { recursive: true });

let guides = 0;
for (const file of readdirSync(docsSrc).filter((f) => f.endsWith('.md') && !SKIP.has(f))) {
	const numMatch = file.match(/^(\d+)-/);
	const order = file === 'DEVELOPMENT.md' ? 50 : numMatch ? Number(numMatch[1]) : 99;
	const title = titleFromH1(readFileSync(join(docsSrc, file), 'utf8'), guideSlug(file));
	emit(join(docsSrc, file), guidesDir, { slug: guideSlug(file), title, order });
	guides++;
}

let adrs = 0;
const decSrc = join(docsSrc, 'decisions');
for (const file of readdirSync(decSrc).filter((f) => f.endsWith('.md') && !SKIP.has(f))) {
	const order = Number((file.match(/^(\d+)/) ?? [])[1] ?? 99);
	const slug = file.replace(/\.md$/i, '').toLowerCase();
	const title = titleFromH1(readFileSync(join(decSrc, file), 'utf8'), slug);
	emit(join(decSrc, file), decisionsDir, { slug, title, order });
	adrs++;
}

console.log(`[sync-docs] synced ${guides} guides + ${adrs} ADRs`);
