import { describe, expect, it } from 'vitest';
import type { InstanceStatus, Workspace } from '../../shared/types';
import { newInstance, newWorkspace } from '../workspaces/model';
import { nextUnread, totalUnread, workspaceUnread } from './aggregate';

const status = (unread: number, extra: Partial<InstanceStatus> = {}): InstanceStatus => ({ state: 'live', unread, dot: false, title: '', url: '', media: [], ...extra });

function ws(id: string, ...types: Parameters<typeof newInstance>[0][]): Workspace {
  const w = newWorkspace({ sub: id, name: id, email: `${id}@x.com` }, [], id);
  types.forEach((t, k) => w.instances.push(newInstance(t, w.instances, `${id}-${k}`)));
  return w;
}

describe('unread totals', () => {
  const a = ws('a', 'facebook', 'whatsapp', 'gmail');
  a.instances[2]!.muted = true;
  const b = ws('b', 'linkedin');
  const st = { 'a-0': status(3), 'a-1': status(12), 'a-2': status(4), 'b-0': status(5) };

  it('skips muted instances', () => {
    expect(workspaceUnread(a, st)).toBe(15);
  });

  it('sums every workspace', () => {
    expect(totalUnread([a, b], st)).toBe(20);
  });
});

describe('nextUnread', () => {
  const a = ws('a', 'facebook', 'whatsapp');
  const b = ws('b', 'gmail', 'linkedin');
  const st = { 'a-0': status(0), 'a-1': status(2), 'b-0': status(0), 'b-1': status(5) };

  it('goes to the next instance with unread items, across workspaces', () => {
    expect(nextUnread([a, b], st, { workspaceId: 'a', instanceId: 'a-1' })).toEqual({ workspaceId: 'b', instanceId: 'b-1' });
  });

  it('wraps around to the start', () => {
    expect(nextUnread([a, b], st, { workspaceId: 'b', instanceId: 'b-1' })).toEqual({ workspaceId: 'a', instanceId: 'a-1' });
  });

  it('skips paused workspaces and signed-out services', () => {
    const paused = { ...b, suspended: true };
    expect(nextUnread([a, paused], st, { workspaceId: 'a', instanceId: 'a-1' })).toBeNull();
    expect(nextUnread([a, b], { ...st, 'b-1': status(5, { state: 'signedout' }) }, { workspaceId: 'a', instanceId: 'a-1' })).toBeNull();
  });

  it('counts dot-only badges', () => {
    expect(nextUnread([a, b], { 'b-0': status(0, { dot: true }) }, { workspaceId: 'a', instanceId: 'a-0' })).toEqual({ workspaceId: 'b', instanceId: 'b-0' });
  });

  it('returns null at inbox zero', () => {
    expect(nextUnread([a, b], {}, { workspaceId: 'a' })).toBeNull();
  });
});
