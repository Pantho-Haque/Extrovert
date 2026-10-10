/** ⌘K command palette (FR-N06) with smart links (FR-X21) and pins (FR-X22); ⌘⇧V saved replies (FR-X23). */
import { useMemo, useState, type ReactNode } from 'react';
import { linkTargets, normalizeLink } from '../../core/routing/links';
import { instanceName, orderedInstances } from '../../core/workspaces/model';
import type { AppSnapshot } from '../../shared/ipc';
import type { Workspace } from '../../shared/types';
import { Icon, type IconName } from './icons';
import { act, findInstance, mod } from './lib';
import type { Overlay } from './Shell';
import { ServiceIcon, useEscape } from './ui';

interface Item {
  group: string;
  text: string;
  view: ReactNode;
  run: () => void;
}

export function Palette({ snap, ws, mode, onClose, onOpen }: { snap: AppSnapshot; ws: Workspace; mode: 'commands' | 'replies'; onClose: () => void; onOpen: (o: Overlay) => void }) {
  useEscape(onClose);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const go = (fn: () => unknown) => () => {
    onClose();
    void fn();
  };

  const items = useMemo<Item[]>(() => {
    if (mode === 'replies') {
      return snap.settings.replies
        .filter((r) => r.toLowerCase().includes(q.toLowerCase()))
        .map((r) => ({ group: 'Saved replies', text: r, view: <><Icon name="msg" size={16} /><b className="reply-t">{r}</b></>, run: go(() => act('insertReply', { text: r })) }))
        .concat([{ group: 'Manage', text: 'manage', view: <><Icon name="gear" size={16} /><b>Edit saved replies</b></>, run: () => onOpen({ kind: 'settings', section: 'notifications' }) }]);
    }
    const link = normalizeLink(q);
    if (link && /\./.test(q)) {
      const targets = linkTargets(link, snap.workspaces, ws.id);
      const list: Item[] = targets.map((t) => {
        const loc = findInstance(snap, t.instanceId)!;
        return { group: 'Open link in the right place', text: link, view: <><ServiceIcon type={loc.inst.type} name={instanceName(loc.inst)} status={snap.statuses[t.instanceId]} size={22} /><b>Open in {instanceName(loc.inst)}</b><span>{loc.ws.name}</span><small>{link}</small></>, run: go(() => act('openLink', { ...t, url: link })) };
      });
      list.push({ group: 'Open link', text: link, view: <><Icon name="globe" size={20} /><b>Open in your browser</b><small>{link}</small></>, run: go(() => act('openExternal', { url: link })) });
      return list;
    }
    const all: Item[] = [];
    for (const w of snap.workspaces) {
      for (const inst of orderedInstances(w.instances)) {
        const st = snap.statuses[inst.id];
        all.push({ group: 'Services', text: `${instanceName(inst)} ${w.name}`, view: <><ServiceIcon type={inst.type} name={instanceName(inst)} status={st} size={22} /><b>{instanceName(inst)}</b><span>{w.name}</span>{(st?.unread ?? 0) > 0 && <em className="badge inline">{st!.unread}</em>}</>, run: go(() => act('selectInstance', { workspaceId: w.id, instanceId: inst.id })) });
      }
    }
    for (const p of snap.settings.pins) {
      const loc = findInstance(snap, p.instanceId);
      if (loc) all.push({ group: 'Pins', text: p.title, view: <><Icon name="pin" size={18} /><b>{p.title}</b><span>{instanceName(loc.inst)} · {loc.ws.name}</span></>, run: go(() => act('openPin', { id: p.id })) });
    }
    const actions: [string, IconName, () => unknown, string?][] = [
      ['Next unread', 'zap', () => act('nextUnread'), `${mod}J`],
      [snap.settings.dnd ? 'Turn off Do Not Disturb' : 'Turn on Do Not Disturb', 'moon', () => act('updateSettings', { patch: { dnd: !snap.settings.dnd } })],
      ['Notifications', 'bell', () => onOpen({ kind: 'notifications' })],
      ['People waiting on me', 'users', () => onOpen({ kind: 'notifications', tab: 'people' })],
      ['Time insights', 'chart', () => onOpen({ kind: 'insights' })],
      ['Task manager', 'activity', () => onOpen({ kind: 'taskManager' })],
      ['Add a service', 'plus', () => onOpen({ kind: 'addService' })],
      ['Saved replies', 'type', () => onOpen({ kind: 'palette', mode: 'replies' }), `${mod}⇧V`],
      ['Zen mode', 'expand', () => act('toggleZen'), `${mod}\\`],
      ['Lock Extrovert', 'lock', () => act('lock'), `${mod}⇧L`],
      ['Downloads', 'download', () => onOpen({ kind: 'downloads' })],
      ['Settings', 'gear', () => onOpen({ kind: 'settings' }), `${mod},`],
    ];
    for (const [text, icon, run, key] of actions) {
      all.push({ group: 'Actions', text, view: <><Icon name={icon} size={18} /><b>{text}</b>{key && <kbd>{key}</kbd>}</>, run: () => { onClose(); void run(); } });
    }
    const s = q.trim().toLowerCase();
    return s ? all.filter((x) => x.text.toLowerCase().includes(s)) : all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, mode, snap]);

  const current = Math.min(sel, Math.max(0, items.length - 1));
  let lastGroup = '';

  return (
    <div className="pal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-label={mode === 'replies' ? 'Saved replies' : 'Command palette'}>
        <div className="pal-in">
          <Icon name={mode === 'replies' ? 'type' : 'search'} />
          <input autoFocus value={q} placeholder={mode === 'replies' ? 'Search saved replies…' : 'Jump to a service, pin or action. Or paste a link…'}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { setSel(Math.min(current + 1, items.length - 1)); e.preventDefault(); }
              if (e.key === 'ArrowUp') { setSel(Math.max(current - 1, 0)); e.preventDefault(); }
              if (e.key === 'Enter') items[current]?.run();
            }} />
        </div>
        <div className="pal-list">
          {items.length === 0 && <p className="empty">No matches.</p>}
          {items.map((it, k) => {
            const head = it.group !== lastGroup ? <div className="pal-g">{(lastGroup = it.group)}</div> : null;
            return (
              <div key={`${it.group}-${k}`}>
                {head}
                <div className={`pal-item ${k === current ? 'sel' : ''}`} onMouseEnter={() => setSel(k)} onClick={it.run} ref={(el) => { if (k === current) el?.scrollIntoView({ block: 'nearest' }); }}>{it.view}</div>
              </div>
            );
          })}
        </div>
        <div className="pal-foot">
          <span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> {mode === 'replies' ? 'paste' : 'open'}</span><span><kbd>esc</kbd> close</span>
          {mode === 'commands' && <span className="tip">Tip: paste a Facebook, Instagram or LinkedIn link</span>}
        </div>
      </div>
    </div>
  );
}
