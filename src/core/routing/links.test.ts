import { describe, expect, it } from 'vitest';
import { newInstance, newWorkspace } from '../workspaces/model';
import { linkTargets, normalizeLink } from './links';

const personal = newWorkspace({ sub: '1', name: 'P', email: 'p@x.com' }, [], 'p');
personal.instances.push(newInstance('instagram', [], 'p-ig'), newInstance('whatsapp', [], 'p-wa'), newInstance('custom', [], 'p-tg', { url: 'https://web.telegram.org/k/', label: 'Telegram' }));
const side = newWorkspace({ sub: '2', name: 'S', email: 's@x.com' }, [personal], 's');
side.instances.push(newInstance('instagram', [], 's-ig'));

describe('linkTargets', () => {
  it('lists matching instances, current workspace first', () => {
    expect(linkTargets('https://www.instagram.com/nadia.clicks', [personal, side], 's')).toEqual([
      { workspaceId: 's', instanceId: 's-ig' },
      { workspaceId: 'p', instanceId: 'p-ig' },
    ]);
  });

  it('matches custom services by their host', () => {
    expect(linkTargets('https://web.telegram.org/k/#@durov', [personal], 'p')).toEqual([{ workspaceId: 'p', instanceId: 'p-tg' }]);
  });

  it('returns nothing for unknown sites or non-web links', () => {
    expect(linkTargets('https://example.com/', [personal], 'p')).toEqual([]);
    expect(linkTargets('mailto:a@b.com', [personal], 'p')).toEqual([]);
  });
});

describe('normalizeLink', () => {
  it('adds https:// to bare addresses', () => {
    expect(normalizeLink('instagram.com/nadia')).toBe('https://instagram.com/nadia');
  });
  it('rejects plain words and sentences', () => {
    expect(normalizeLink('whatsapp')).toBeNull();
    expect(normalizeLink('open my inbox')).toBeNull();
  });
});
