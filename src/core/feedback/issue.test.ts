import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { issueUrl, MAX_DETAILS, reportText, systemInfo, type SystemFacts } from './issue';

const facts: SystemFacts = {
  version: '0.0.1', os: 'macOS 26.5', arch: 'arm64', electron: '44.7.0', chrome: '146.0',
  workspaces: 2,
  services: [{ name: 'Gmail', state: 'live', signedIn: true }, { name: 'WhatsApp', state: 'loading' }],
  settings: { dnd: true, digest: false },
};
const report = { title: ' Badge stuck at 0 ', details: 'It never updates & stays 0', severity: 'annoying' as const, where: 'WhatsApp' };

describe('bug report link', () => {
  it('fills every field of the issue form', () => {
    const url = new URL(issueUrl(report, systemInfo(facts)));
    expect(url.origin + url.pathname).toBe('https://github.com/Pantho-Haque/Extrovert/issues/new');
    const p = Object.fromEntries(url.searchParams);
    expect(p).toMatchObject({ template: 'bug_report.yml', title: 'Badge stuck at 0', severity: 'Annoying', service: 'WhatsApp', details: 'It never updates & stays 0' });
    expect(p.system).toContain('Gmail (live, signed in), WhatsApp (loading)');
    expect(p.system).toContain('Settings on: dnd');
  });

  it('keeps the link short enough for browsers', () => {
    expect(issueUrl({ ...report, details: 'x'.repeat(10_000) }, systemInfo(facts)).length).toBeLessThan(MAX_DETAILS + 1000);
  });

  it('copies as plain text', () => {
    expect(reportText(report, 'sys')).toBe('Badge stuck at 0\n\nHow bad: Annoying\nWhere: WhatsApp\n\nIt never updates & stays 0\n\n---\nsys');
  });

  it('matches the field ids of the repo issue form', () => {
    const form = readFileSync(join(__dirname, '../../../.github/ISSUE_TEMPLATE/bug_report.yml'), 'utf8');
    const ids = [...form.matchAll(/^\s+id: (\w+)/gm)].map((m) => m[1]);
    const params = [...new URL(issueUrl(report, 'sys')).searchParams.keys()].filter((k) => k !== 'template' && k !== 'title');
    expect(ids.sort()).toEqual(params.sort());
  });
});
