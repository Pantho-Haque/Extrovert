/** Renders the registry into the README and the landing page, between `<!-- guide:NAME -->` markers. */
import { ICON_PATHS } from '../../renderer/src/icons';
import { accel, FEATURE_GROUPS, formatKeys, SHORTCUTS, type Feature } from './registry';

const both = (keys: string) => {
  const mac = formatKeys(keys, true);
  const pc = formatKeys(keys, false);
  return mac === pc ? mac : `${mac} / ${pc}`;
};

const mdFeature = (f: Feature) =>
  `- **${f.title}**: ${f.text}${f.shortcut ? ` \`${both(SHORTCUTS.find((s) => s.id === f.shortcut)!.keys)}\`` : ''}${f.macOnly ? ' *(macOS)*' : ''}`;

export function readmeFeatures(): string {
  return FEATURE_GROUPS.map((g) => `### ${g.title}\n\n${g.tagline}\n\n${g.features.map(mdFeature).join('\n')}`).join('\n\n');
}

export function readmeShortcuts(): string {
  const rows = SHORTCUTS.map((s) => `| ${s.label} | \`${formatKeys(s.keys, true)}\` | \`${formatKeys(s.keys, false)}\` |`);
  return ['| Action | macOS | Windows & Linux |', '|---|---|---|', ...rows].join('\n');
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function siteFeatures(): string {
  return FEATURE_GROUPS.map((g) => `<article class="fgroup" id="f-${g.id}" data-icon="${g.icon}">
  <h3>${esc(g.title)}</h3>
  <p class="tagline">${esc(g.tagline)}</p>
  <ul>
${g.features.map((f) => `    <li><b>${esc(f.title)}</b>${f.shortcut ? ` ${siteKbd(accel(f.shortcut))}` : ''}${f.macOnly ? ' <span class="chip">macOS</span>' : ''}<span>${esc(f.text)}</span></li>`).join('\n')}
  </ul>
</article>`).join('\n');
}

const icon = (name: string) => `<svg class="i"><use href="#i-${name}"/></svg>`;

/** The features no other hub has, as cards. */
export function siteHighlights(): string {
  return FEATURE_GROUPS.flatMap((g) => g.features.filter((f) => f.unique).map((f) => {
    const more = [f.details && `<p class="more">${esc(f.details)}</p>`, (f.where || f.shortcut) && `<p class="hl-meta">${f.shortcut ? siteKbd(accel(f.shortcut)) : ''}${f.where ? `<span>${esc(f.where)}</span>` : ''}</p>`].filter(Boolean).join('');
    return `<div class="hl" data-feature="${slug(f.title)}">${icon(f.icon ?? g.icon)}<b>${esc(f.title)}</b><p>${esc(f.text)}</p>${more}</div>`;
  })).join('\n');
}

/** Every UI icon of the app, as an SVG sprite, so the website and its demo use exactly the app's icons. */
export function siteIcons(): string {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(ICON_PATHS).map(([n, paths]) => `<symbol id="i-${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</symbol>`).join('')}</svg>`;
}

/** macOS keys by default; the page swaps in `data-pc` for Windows and Linux visitors. */
const siteKbd = (keys: string) => `<kbd class="k" data-pc="${esc(formatKeys(keys, false))}">${esc(formatKeys(keys, true))}</kbd>`;

/** Every shortcut, grouped, with keys for both platforms (the page's live keyboard lights them up). */
export function siteShortcuts(): string {
  const groups = [...new Set(SHORTCUTS.map((s) => s.group))];
  return groups.map((g) => `<div class="kgroup"><h4>${g}</h4>
${SHORTCUTS.filter((s) => s.group === g).map((s) => `<button class="kbind" data-keys="${esc(s.keys)}"><span>${esc(s.label)}</span><kbd data-mac="${esc(formatKeys(s.keys, true))}" data-pc="${esc(formatKeys(s.keys, false))}">${esc(formatKeys(s.keys, true))}</kbd></button>`).join('\n')}
</div>`).join('\n');
}

/** Puts `body` between the markers of `name`. Throws if the markers are missing. */
export function replaceBlock(text: string, name: string, body: string): string {
  const start = `<!-- guide:${name} -->`;
  const end = `<!-- /guide:${name} -->`;
  const a = text.indexOf(start);
  const b = text.indexOf(end);
  if (a < 0 || b < a) throw new Error(`Missing ${start} … ${end}`);
  return `${text.slice(0, a + start.length)}\n${body}\n${text.slice(b)}`;
}

/** Every generated block, per file (paths from the repository root). */
export const DOC_BLOCKS: Record<string, Record<string, () => string>> = {
  'README.md': { features: readmeFeatures, shortcuts: readmeShortcuts },
  'docs/index.html': { icons: siteIcons, highlights: siteHighlights, features: siteFeatures, shortcuts: siteShortcuts },
};
