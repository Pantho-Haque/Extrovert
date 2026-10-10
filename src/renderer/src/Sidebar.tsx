import { useRef } from 'react';
import { formatKeys, keyOf } from '../../core/guide/registry';
import { groupInstances, instanceName, instanceTag } from '../../core/workspaces/model';
import { workspaceUnread } from '../../core/unread/aggregate';
import type { AppSnapshot } from '../../shared/ipc';
import type { Instance, Workspace } from '../../shared/types';
import { Icon } from './icons';
import { act, isMac } from './lib';
import type { Overlay } from './Shell';
import { Avatar, ServiceIcon } from './ui';

const TAG_COLORS = ['#64748B', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

export function Sidebar({ snap, ws, onOpen }: { snap: AppSnapshot; ws: Workspace; onOpen: (o: Overlay) => void }) {
  const rt = snap.runtime;
  const others = snap.workspaces.filter((w) => w.id !== ws.id && !w.suspended).reduce((n, w) => n + workspaceUnread(w, snap.statuses), 0);
  const groups = groupInstances(ws.instances.filter((i) => i.enabled));
  const order = groups.flat();
  const activeId = ws.activeInstanceId ?? order[0]?.id;
  const downloading = snap.downloads.filter((d) => d.state === 'progressing').length;

  return (
    <aside className={`sidebar ${isMac ? 'mac' : ''}`}>
      <button className="acct-btn" style={{ ['--c' as string]: ws.color }} onClick={() => onOpen({ kind: 'account' })} aria-haspopup="menu"
        title={`${ws.name} · ${ws.email}${others ? ` · ${others} unread in other accounts` : ''}\nClick to switch account`}>
        <Avatar ws={ws} size={42} />
        {others > 0 && !rt.sharing && <span key={others} className="badge pop">{others > 99 ? '99+' : others}</span>}
        <span className="acct-chev"><Icon name="down" size={10} /></span>
      </button>
      <div className="sb-sep" />
      <nav className="svc-list" aria-label="Services">
        {groups.map((group) => {
          const buttons = group.map((inst, k) => (
            <ServiceButton key={inst.id} snap={snap} ws={ws} inst={inst} active={inst.id === activeId} index={order.indexOf(inst)} tag={instanceTag(inst, group)} tagColor={TAG_COLORS[k % TAG_COLORS.length]!} />
          ));
          return group.length > 1 ? <div key={group[0]!.type} className="svc-group" aria-label={`${group.length} ${instanceName({ type: group[0]!.type })} accounts`}>{buttons}</div> : buttons;
        })}
        <button className="sb-btn" onClick={() => onOpen({ kind: 'addService' })} aria-label="Add service" title={`Add services (${keyOf('addService', isMac)})`}><Icon name="plus" /></button>
      </nav>
      <div className="sb-bottom">
        <button className={`sb-btn ${snap.settings.dnd ? 'dnd' : ''}`} onClick={() => onOpen({ kind: 'notifications' })} aria-label="Notifications"
          title={snap.settings.dnd ? 'Notifications · Do Not Disturb is on' : snap.settings.digest.enabled ? 'Notifications · digest mode' : 'Notifications · history, people, snoozed'}>
          <Icon name={snap.settings.dnd ? 'moon' : 'bell'} />
          {snap.digest.length > 0 && <span className="badge grey">{snap.digest.length}</span>}
        </button>
        <button className="sb-btn" onClick={() => onOpen({ kind: 'downloads' })} aria-label="Downloads" title="Downloads">
          <Icon name="download" />
          {downloading > 0 && <span className="badge grey">{downloading}</span>}
        </button>
        <button className="sb-btn" onClick={() => onOpen({ kind: 'guide' })} aria-label="Shortcuts & features" title={`Shortcuts & features (${keyOf('guide', isMac)})`}><Icon name="command" /></button>
        <button className="sb-btn" onClick={() => onOpen({ kind: 'insights' })} aria-label="Time insights" title="Time insights"><Icon name="chart" /></button>
        <button className="sb-btn" onClick={() => onOpen({ kind: 'settings' })} aria-label="Settings" title={`Settings (${keyOf('settings', isMac)})`}><Icon name="gear" /></button>
      </div>
    </aside>
  );
}

function ServiceButton({ snap, ws, inst, active, index, tag, tagColor }: { snap: AppSnapshot; ws: Workspace; inst: Instance; active: boolean; index: number; tag: string; tagColor: string }) {
  const st = snap.statuses[inst.id];
  const peeking = useRef(false);
  const name = instanceName(inst);
  const dim = ws.suspended || inst.muted || st?.state === 'sleeping' || st?.state === 'signedout';
  const status = st?.state === 'signedout' ? 'Signed out' : st?.state === 'syncing' ? 'Reconnecting…' : st?.state === 'sleeping' ? 'Sleeping' : st?.state === 'offline' ? 'Offline'
    : st?.unread ? `${st.unread} unread` : st?.state === 'loading' ? 'Loading…' : 'No new items';
  const media = st?.media ?? [];
  const mediaIcon = media.includes('screen') ? 'screen' : media.includes('camera') ? 'camera' : media.includes('mic') ? 'mic' : null;

  return (
    <button
      className={`svc ${active ? 'active' : ''} ${dim ? 'dim' : ''}`}
      onClick={() => act('selectInstance', { workspaceId: ws.id, instanceId: inst.id })}
      onContextMenu={(e) => {
        e.preventDefault();
        void act('instanceMenu', { workspaceId: ws.id, instanceId: inst.id });
      }}
      onMouseEnter={(e) => {
        // Hold Alt/Option while hovering to peek without switching (FR-X08).
        if (!e.altKey || active || st?.state !== 'live') return;
        peeking.current = true;
        const r = e.currentTarget.getBoundingClientRect();
        void act('peek', { workspaceId: ws.id, instanceId: inst.id, x: r.right, y: r.top });
      }}
      onMouseLeave={() => {
        if (peeking.current) void act('hidePeek');
        peeking.current = false;
      }}
      aria-label={`${name}, ${status}`}
      title={`${name} · ${status}${index < 9 ? ` (${formatKeys(`CmdOrCtrl+${index + 1}`, isMac)})` : ''}\nRight-click for more · ${keyOf('peek', isMac)} to peek`}
    >
      <ServiceIcon type={inst.type} look={inst} status={st} name={name} />
      {inst.badge && !inst.muted && (st?.unread ?? 0) > 0 && <span key={st!.unread} className="badge pop">{st!.unread > 99 ? '99+' : st!.unread}</span>}
      {inst.badge && !inst.muted && !st?.unread && st?.dot && <span className="badge dot" />}
      {mediaIcon && <span className="media-dot" title={`Using your ${mediaIcon}`}><Icon name={mediaIcon} size={9} /></span>}
      {!mediaIcon && st?.state === 'signedout' && <span className="warn-dot"><Icon name="alert" size={9} /></span>}
      {tag && <span className="inst-tag" style={{ ['--t' as string]: tagColor }}>{tag}</span>}
    </button>
  );
}
