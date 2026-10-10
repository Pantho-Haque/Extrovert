import { describe, expect, it } from 'vitest';
import type { Instance } from '../../shared/types';
import { defaultSession, groupInstances, instanceName, instanceTag, migrateSessions, newInstance, newWorkspace, orderedInstances, orphanPartitionFolders, outsideWorkHours, partitionFor, startUrl } from './model';

const inst = (id: string, type: Instance['type'], extra: Partial<Instance> = {}): Instance => ({ ...newInstance(type, [], id), ...extra });

describe('newInstance', () => {
  it('needs no label for the first of its kind', () => {
    expect(newInstance('whatsapp', [], 'a').label).toBeUndefined();
  });

  it('numbers the second account of the same service', () => {
    const second = newInstance('whatsapp', [inst('a', 'whatsapp')], 'b');
    expect(second.label).toBe('WhatsApp 2');
    expect(instanceName(second)).toBe('WhatsApp 2');
  });

  it('keeps the icon and color picked for a website', () => {
    expect(newInstance('custom', [], 'a', { url: 'https://web.telegram.org/', icon: 'brand-telegram', color: '#0EA5E9' })).toMatchObject({ icon: 'brand-telegram', color: '#0EA5E9' });
  });

  it('turns autoplay off for feeds only', () => {
    expect(newInstance('facebook', [], 'a').autoplay).toBe(false);
    expect(newInstance('whatsapp', [], 'a').autoplay).toBe(true);
  });
});

describe('grouping and order', () => {
  const list = [inst('1', 'facebook'), inst('2', 'whatsapp'), inst('3', 'gmail'), inst('4', 'whatsapp', { label: 'WhatsApp · Business' }), inst('5', 'linkedin', { enabled: false })];

  it('keeps same-type instances together in first-appearance order', () => {
    expect(groupInstances(list).map((g) => g.map((i) => i.id))).toEqual([['1'], ['2', '4'], ['3'], ['5']]);
  });

  it('orders enabled instances for the sidebar and shortcuts', () => {
    expect(orderedInstances(list).map((i) => i.id)).toEqual(['1', '2', '4', '3']);
  });

  it('tags grouped instances by nickname initial or position', () => {
    const group = groupInstances(list)[1]!;
    expect(instanceTag(group[0]!, group)).toBe('1');
    expect(instanceTag(group[1]!, group)).toBe('B');
    expect(instanceTag(list[0]!, [list[0]!])).toBe('');
  });
});

describe('newWorkspace', () => {
  it('picks an unused color and the first name', () => {
    const a = newWorkspace({ sub: '1', name: 'Pantho Haque', email: 'p@gmail.com' }, [], 'w1');
    const b = newWorkspace({ sub: '2', name: 'Work Account', email: 'w@co.com' }, [a], 'w2');
    expect(a.name).toBe('Pantho');
    expect(b.color).not.toBe(a.color);
  });
});

describe('outsideWorkHours', () => {
  const wh = { enabled: true, days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' };
  const at = (iso: string) => new Date(iso);

  it('is false while disabled', () => {
    expect(outsideWorkHours({ ...wh, enabled: false }, at('2026-10-11T23:00:00'))).toBe(false);
  });

  it('checks day and time', () => {
    expect(outsideWorkHours(wh, at('2026-10-12T10:00:00'))).toBe(false); // Monday 10:00
    expect(outsideWorkHours(wh, at('2026-10-12T18:00:00'))).toBe(true); // end is exclusive
    expect(outsideWorkHours(wh, at('2026-10-11T10:00:00'))).toBe(true); // Sunday
  });

  it('supports overnight hours', () => {
    const night = { ...wh, days: [0, 1, 2, 3, 4, 5, 6], start: '22:00', end: '06:00' };
    expect(outsideWorkHours(night, at('2026-10-12T23:30:00'))).toBe(false);
    expect(outsideWorkHours(night, at('2026-10-12T12:00:00'))).toBe(true);
  });
});

describe('shared logins', () => {
  it('names storage per workspace and login', () => {
    expect(partitionFor('w1', 'google')).toBe('persist:w1:google');
  });

  it('shares one Google login across Google apps and one Meta login across Facebook and Messenger', () => {
    const list: Parameters<typeof defaultSession>[1] = [];
    const add = (type: Parameters<typeof defaultSession>[0], id: string) => {
      const session = defaultSession(type, list, id);
      list.push({ type });
      return session;
    };
    expect(add('gmail', 'g1')).toBe('google');
    expect(add('calendar', 'c1')).toBe('google');
    expect(add('facebook', 'f1')).toBe('meta');
    expect(add('messenger', 'm1')).toBe('meta');
    expect(add('whatsapp', 'w1')).toBe('w1');
    expect(add('gmail', 'g2')).toBe('g2'); // a second Gmail account keeps its own login
  });

  it('moves older per-service logins into the shared ones without signing anyone out', () => {
    const ws = newWorkspace({ sub: '1', name: 'P', email: 'p@x.com' }, [], 'w1');
    ws.instances = [newInstance('whatsapp', [], 'wa'), newInstance('gmail', [], 'gm'), newInstance('calendar', [], 'ca'), newInstance('gmail', [], 'gm2')];
    for (const i of ws.instances) (i as { session?: string }).session = undefined;
    expect(migrateSessions(ws)).toEqual([{ from: 'w1%3Agm', to: 'w1%3Agoogle' }]);
    expect(ws.instances.map((i) => i.session)).toEqual(['wa', 'google', 'google', 'gm2']);
    expect(migrateSessions(ws)).toEqual([]); // already done
  });
});

describe('startUrl', () => {
  const ws = newWorkspace({ sub: '1', name: 'Pantho', email: 'pantho.haque@pathao.com' }, [], 'w1');
  ws.instances.push(newInstance('gmail', [], 'g1'), newInstance('facebook', [], 'f1'));
  ws.instances.push(newInstance('gmail', ws.instances, 'g2'));

  it("opens the workspace's own Google account, not the browser's first one", () => {
    expect(startUrl(ws, ws.instances[0]!)).toBe('https://mail.google.com/mail/?authuser=pantho.haque%40pathao.com');
  });

  it('leaves non-Google services and extra Google accounts alone', () => {
    expect(startUrl(ws, ws.instances[1]!)).toBe('https://www.facebook.com/');
    expect(startUrl(ws, ws.instances[2]!)).toBe('https://mail.google.com/mail/');
  });

  it('respects a custom address', () => {
    expect(startUrl(ws, { ...ws.instances[0]!, url: 'https://mail.google.com/mail/u/3/' })).toBe('https://mail.google.com/mail/u/3/');
  });
});

describe('orphanPartitionFolders', () => {
  const ws = newWorkspace({ sub: '1', name: 'P', email: 'p@x.com' }, [], 'w-abc');
  ws.instances.push(newInstance('facebook', [], 'i-fb'));
  ws.instances.push(newInstance('whatsapp', ws.instances, 'i-wa'));

  it('keeps the logins of existing services and deletes the rest of ours', () => {
    const folders = ['w-abc%3Ameta', 'w-abc%3Ai-wa', 'w-gone%3Ai-li', 'default%3Afacebook', 'w-abc%3Ai-removed', 'w-abc%3Ai-fb'];
    expect(orphanPartitionFolders(folders, [ws])).toEqual(['w-gone%3Ai-li', 'default%3Afacebook', 'w-abc%3Ai-removed', 'w-abc%3Ai-fb']);
  });

  it('matches regardless of escape case', () => {
    expect(orphanPartitionFolders(['w-abc%3aMETA'], [ws])).toEqual([]);
  });

  it('never touches folders that are not workspace logins', () => {
    expect(orphanPartitionFolders(['extrovert-icons', 'something-else'], [ws])).toEqual([]);
  });

  it('deletes everything of ours when no workspaces are left', () => {
    expect(orphanPartitionFolders(['w-abc%3Ameta'], [])).toEqual(['w-abc%3Ameta']);
  });
});
