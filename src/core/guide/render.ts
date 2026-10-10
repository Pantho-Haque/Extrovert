/** Renders the registry into the README and the landing page, between `<!-- guide:NAME -->` markers. */
import { ICON_PATHS } from '../../renderer/src/icons';
import { FEATURE_GROUPS, formatKeys, keyOf, SHORTCUTS, type Feature } from './registry';

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

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function siteFeatures(): string {
  return FEATURE_GROUPS.map((g) => `<article class="fgroup" id="${g.id}">
  <h3>${esc(g.title)}</h3>
  <p class="tagline">${esc(g.tagline)}</p>
  <ul>
${g.features.map((f) => `    <li><b>${esc(f.title)}</b>${f.shortcut ? ` <kbd>${esc(keyOf(f.shortcut, true))}</kbd>` : ''}${f.macOnly ? ' <span class="chip">macOS</span>' : ''}<span>${esc(f.text)}</span></li>`).join('\n')}
  </ul>
</article>`).join('\n');
}

const icon = (name: string) => `<svg class="i"><use href="#i-${name}"/></svg>`;

/** The features no other hub has, as cards. */
export function siteHighlights(): string {
  return FEATURE_GROUPS.flatMap((g) => g.features.filter((f) => f.unique).map((f) => `<div class="hl">${icon(g.icon)}<b>${esc(f.title)}</b><p>${esc(f.text)}</p></div>`)).join('\n');
}

/** The app's own UI icons used by the cards above, as an SVG sprite. */
export function siteIcons(): string {
  const used = [...new Set(FEATURE_GROUPS.map((g) => g.icon))];
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${used.map((n) => `<symbol id="i-${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[n as keyof typeof ICON_PATHS]}</symbol>`).join('')}</svg>`;
}

export function siteShortcuts(): string {
  return SHORTCUTS.map((s) => `<div><kbd>${esc(formatKeys(s.keys, true))}</kbd><span>${esc(s.label)}</span></div>`).join('\n');
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
