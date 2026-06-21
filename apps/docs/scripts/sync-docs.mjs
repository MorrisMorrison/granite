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
			if (rel.startsWith('decisions/')) {
				const slug = basename(rel).replace(/\.md$/i, '').toLowerCase();
				return `](${BASE}/decisions/${slug}/${suffix})`;
			}
			return `](${BASE}/guides/${guideSlug(basename(rel))}/${suffix})`;
		}
		if (underDocs && relative(docsSrc, abs).replace(/\\/g, '/') === 'decisions') {
			return `](${BASE}/decisions/${suffix})`;
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
