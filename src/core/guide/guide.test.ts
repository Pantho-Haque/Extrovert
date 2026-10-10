import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isIconName } from '../../renderer/src/icons';
import { FEATURE_GROUPS, formatKeys, SHORTCUTS } from './registry';
import { DOC_BLOCKS, replaceBlock } from './render';

const ROOT = join(__dirname, '../../..');

describe('formatKeys', () => {
  it('uses symbols on macOS and words elsewhere', () => {
    expect(formatKeys('CmdOrCtrl+Shift+L', true)).toBe('⌘⇧L');
    expect(formatKeys('CmdOrCtrl+Shift+L', false)).toBe('Ctrl+Shift+L');
    expect(formatKeys('CmdOrCtrl+1-9', true)).toBe('⌘1–9');
    expect(formatKeys('Alt+Hover', false)).toBe('Alt + hover');
    expect(formatKeys('CmdOrCtrl+-', false)).toBe('Ctrl+-');
  });
});

describe('registry', () => {
  it("doesn't clash with Electron's built-in edit and window shortcuts on Windows and Linux", () => {
    // Electron's role defaults there, plus Ctrl+Shift+V (paste as plain text in every browser).
    const builtIn = ['CmdOrCtrl+Z', 'CmdOrCtrl+Y', 'CmdOrCtrl+Shift+Z', 'CmdOrCtrl+X', 'CmdOrCtrl+C', 'CmdOrCtrl+V', 'CmdOrCtrl+Shift+V', 'CmdOrCtrl+A', 'CmdOrCtrl+W', 'CmdOrCtrl+M', 'CmdOrCtrl+Q', 'F11'];
    expect(SHORTCUTS.filter((s) => builtIn.includes(s.keys)).map((s) => s.id)).toEqual([]);
  });

  it('has unique shortcuts and real icons', () => {
    expect(new Set(SHORTCUTS.map((s) => s.keys)).size).toBe(SHORTCUTS.length);
    const icons = [...FEATURE_GROUPS.map((g) => g.icon), ...FEATURE_GROUPS.flatMap((g) => g.features.flatMap((f) => (f.icon ? [f.icon] : [])))];
    expect(icons.filter((i) => !isIconName(i))).toEqual([]);
  });
});

// The README and the landing page list the features from the registry. `pnpm sync-docs` rewrites them.
describe('docs match the app', () => {
  for (const [file, blocks] of Object.entries(DOC_BLOCKS)) {
    it(`${file} is up to date`, () => {
      const path = join(ROOT, file);
      expect(existsSync(path), `${file} is missing`).toBe(true);
      const text = readFileSync(path, 'utf8');
      const fresh = Object.entries(blocks).reduce((t, [name, render]) => replaceBlock(t, name, render()), text);
      if (process.env.UPDATE_DOCS) writeFileSync(path, fresh);
      else expect(text, `${file} is out of date: run pnpm sync-docs`).toBe(fresh);
    });
  }
});
