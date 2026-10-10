/** Notification history across every service (FR-A07), people view (FR-X07), snooze (FR-X03), VIPs (FR-X04). */
import { useState } from 'react';
import { groupByPerson, isVip } from '../../core/notifications/rules';
import { instanceName } from '../../core/workspaces/model';
import type { AppSnapshot } from '../../shared/ipc';
import type { NotificationEntry } from '../../shared/types';
import { Icon } from './icons';
import { act, findInstance, timeAgo } from './lib';
import { PersonAvatar, ServiceIcon, useEscape } from './ui';

type Tab = 'all' | 'people' | 'snoozed';
const SNOOZE = [['15m', '15 min'], ['1h', '1 hour'], ['tonight', 'Tonight'], ['tomorrow', 'Tomorrow']] as const;

export function NotificationCenter({ snap, initialTab, onClose }: { snap: AppSnapshot; initialTab?: Tab | undefined; onClose: () => void }) {
  useEscape(onClose);
  const [tab, setTab] = useState<Tab>(initialTab ?? 'all');
  const [wsFilter, setWsFilter] = useState('all');
  const [query, setQuery] = useState('');
  const { settings } = snap;
  const list = snap.notifications.filter((n) => (wsFilter === 'all' || n.workspaceId === wsFilter) && `${n.sender} ${n.body}`.toLowerCase().includes(query.toLowerCase()));
  const open = (n: NotificationEntry) => {
    onClose();
    void act('openNotification', { id: n.id });
  };

  return (
    <>
      <div className="click-away" onMouseDown={onClose} />
      <aside className="nc" aria-label="Notifications">
        <div className="nc-h">
          <h3>Notifications</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        {snap.digest.length > 0 && (
          <div className="nc-banner"><Icon name="clock" size={16} /> {snap.digest.length} held for your next digest <button className="btn sm" onClick={() => act('deliverDigest')}>Deliver now</button></div>
        )}
        {settings.dnd && (
          <div className="nc-banner"><Icon name="moon" size={16} /> Do Not Disturb is on. VIPs still get through. <button className="btn sm" onClick={() => act('updateSettings', { patch: { dnd: false } })}>Turn off</button></div>
        )}
        <div className="nc-search"><Icon name="search" size={14} /><input placeholder="Search notifications" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus /></div>
        <div className="seg">
          {(['all', 'people', 'snoozed'] as const).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {t === 'all' ? 'All' : t === 'people' ? 'People' : `Snoozed${snap.snoozed.length ? ` (${snap.snoozed.length})` : ''}`}
            </button>
          ))}
        </div>
        {snap.workspaces.length > 1 && (
          <div className="chips">
            {[{ id: 'all', name: 'All workspaces' }, ...snap.workspaces].map((w) => (
              <button key={w.id} className={`chip ${wsFilter === w.id ? 'on' : ''}`} onClick={() => setWsFilter(w.id)}>{w.name}</button>
            ))}
          </div>
        )}
        <div className="nc-list">
          {tab === 'all' && (list.length ? list.slice(0, 300).map((n) => <Row key={n.id} snap={snap} n={n} onOpen={() => open(n)} />) : <p className="empty">Nothing here yet. Notifications from every service will collect here.</p>)}
          {tab === 'people' && <People snap={snap} list={list} onOpen={open} />}
          {tab === 'snoozed' && (snap.snoozed.length ? snap.snoozed.map(({ entry, until }) => (
            <div key={entry.id} className="nrow" onClick={() => open(entry)}>
              <PersonAvatar name={entry.sender} size={36} />
              <div className="nrow-m"><b>{entry.sender}</b><p>{entry.body}</p><small><Icon name="clock" size={11} /> Back {new Date(until).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</small></div>
            </div>
          )) : <p className="empty">Nothing snoozed. Use the clock on any notification to be reminded later; the reminder opens that exact chat.</p>)}
        </div>
        {snap.notifications.length > 0 && <button className="linkish" onClick={() => act('clearHistory')}>Clear history</button>}
      </aside>
    </>
  );
}

function Row({ snap, n, onOpen }: { snap: AppSnapshot; n: NotificationEntry; onOpen: () => void }) {
  const [snoozing, setSnoozing] = useState(false);
  const loc = findInstance(snap, n.instanceId);
  const vip = isVip(n.sender, snap.settings);
  return (
    <div className="nrow" onClick={onOpen}>
      <div className="nrow-av">
        <PersonAvatar name={n.sender} size={36} />
        {loc && <span className="nrow-logo"><ServiceIcon type={loc.inst.type} look={loc.inst} name={instanceName(loc.inst)} status={snap.statuses[loc.inst.id]} size={16} /></span>}
      </div>
      <div className="nrow-m">
        <b>{vip && <span className="vip"><Icon name="star" size={11} /></span>}{n.sender}</b>
        <p>{n.body}</p>
        <small>{loc ? `${instanceName(loc.inst)} · ${loc.ws.name}` : 'Removed service'} · {timeAgo(n.at)}</small>
      </div>
      <div className="nrow-a" onClick={(e) => e.stopPropagation()}>
        <button className={`icon-btn ${vip ? 'vip-on' : ''}`} title={vip ? 'Remove VIP' : 'Mark as VIP (gets through Do Not Disturb)'} onClick={() => act('toggleVip', { name: n.sender })}><Icon name="star" size={15} /></button>
        <button className="icon-btn" title="Snooze" onClick={() => setSnoozing(!snoozing)}><Icon name="clock" size={15} /></button>
      </div>
      {snoozing && (
        <div className="snooze-opts" onClick={(e) => e.stopPropagation()}>
          {SNOOZE.map(([choice, label]) => <button key={choice} className="chip" onClick={() => { setSnoozing(false); void act('snooze', { id: n.id, choice }); }}>{label}</button>)}
        </div>
      )}
    </div>
  );
}

function People({ snap, list, onOpen }: { snap: AppSnapshot; list: NotificationEntry[]; onOpen: (n: NotificationEntry) => void }) {
  const [linking, setLinking] = useState<string | null>(null);
  const groups = groupByPerson(list, snap.settings.personLinks);
  if (!groups.length) return <p className="empty">No one is waiting on you right now.</p>;
  return (
    <>
      <p className="hint"><Icon name="users" size={14} /> Who's waiting on you, grouped by person across every platform.</p>
      {groups.map((g) => {
        const byService = new Map<string, number>();
        for (const e of g.entries) byService.set(e.instanceId, (byService.get(e.instanceId) ?? 0) + 1);
        return (
          <div key={g.person}>
            <div className="prow" onClick={() => onOpen(g.entries[0]!)}>
              <PersonAvatar name={g.person} size={40} />
              <div className="nrow-m">
                <b>{isVip(g.person, snap.settings) && <span className="vip"><Icon name="star" size={11} /></span>}{g.person}</b>
                {g.names.length > 1 && <small className="linked"><Icon name="link" size={11} /> Linked: {g.names.join(' + ')}</small>}
                <div className="papps">
                  {[...byService].map(([instanceId, count]) => {
                    const loc = findInstance(snap, instanceId);
                    return loc ? <span key={instanceId}><ServiceIcon type={loc.inst.type} look={loc.inst} name={instanceName(loc.inst)} status={snap.statuses[instanceId]} size={16} /> {count} {instanceName(loc.inst)}</span> : null;
                  })}
                </div>
              </div>
              <button className="btn sm" onClick={(e) => { e.stopPropagation(); setLinking(linking === g.person ? null : g.person); }}>Link names</button>
            </div>
            {linking === g.person && (
              <div className="link-names">
                <small className="muted">Same person as</small>
                <select defaultValue="" onChange={(e) => { if (e.target.value) { void act('linkNames', { name: g.person, to: e.target.value }); setLinking(null); } }}>
                  <option value="" disabled>Choose…</option>
                  {groups.filter((o) => o.person !== g.person).map((o) => <option key={o.person} value={o.person}>{o.person}</option>)}
                </select>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
