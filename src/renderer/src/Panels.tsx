/** Small surfaces with their own views: toasts, find bar, peek, and the tray mini view. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { workspaceUnread } from '../../core/unread/aggregate';
import { instanceName, orderedInstances } from '../../core/workspaces/model';
import type { AppSnapshot, ActionName, FloatingName } from '../../shared/ipc';
import { Icon } from './icons';
import { act, findInstance } from './lib';
import { Avatar, Brand, ServiceIcon, Switch } from './ui';

/**
 * Reports the panel's content size to main, which sizes the transparent view to fit. A callback ref,
 * so a panel whose root element changes (peek: empty → snapshot) is measured again.
 */
function useReportSize(name: FloatingName) {
  const [el, ref] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!el) return;
    const report = () => void act('resizeFloating', { name, width: el.offsetWidth, height: el.offsetHeight });
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, name]);
  return ref;
}

export function ToastsPanel({ snap }: { snap: AppSnapshot }) {
  const ref = useReportSize('toasts');
  return (
    <div ref={ref} className="panel-root">
      <div className="toasts">
        {snap.runtime.toasts.map((t) => (
          <div key={t.id} className={`snack ${t.tone === 'warn' ? 'warn' : ''}`} role="status">
            <span>{t.text}</span>
            {t.actions?.map((a) => (
              <button key={a.label} onClick={() => { void act(a.action as ActionName, a.payload as never); if (!t.persistent || a.action !== 'stopSharing') void act('dismissToast', { id: t.id }); }}>{a.label}</button>
            ))}
            <button className="x" aria-label="Dismiss" onClick={() => act('dismissToast', { id: t.id })}><Icon name="x" size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FindPanel({ snap }: { snap: AppSnapshot }) {
  const ref = useReportSize('find');
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const find = snap.runtime.find;
  useEffect(() => {
    if (find) input.current?.focus();
  }, [!!find]);
  return (
    <div ref={ref} className="panel-root">
      <div className="findbar">
        <Icon name="search" size={14} />
        <input ref={input} placeholder="Find in page" value={text}
          onChange={(e) => { setText(e.target.value); void act('find', { text: e.target.value }); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void act('find', { text, forward: !e.shiftKey, next: true });
            if (e.key === 'Escape') { setText(''); void act('stopFind'); }
          }} />
        <span className="count">{find && text ? `${find.active} of ${find.matches}` : ''}</span>
        <button className="icon-btn" aria-label="Previous" onClick={() => act('find', { text, forward: false, next: true })}><Icon name="up" size={14} /></button>
        <button className="icon-btn" aria-label="Next" onClick={() => act('find', { text, forward: true, next: true })}><Icon name="down" size={14} /></button>
        <button className="icon-btn" aria-label="Close" onClick={() => { setText(''); void act('stopFind'); }}><Icon name="x" size={14} /></button>
      </div>
    </div>
  );
}

export function PeekPanel({ snap }: { snap: AppSnapshot }) {
  const peek = snap.runtime.peek;
  const loc = peek && findInstance(snap, peek.instanceId);
  if (!peek || !loc) return null;
  return (
    <div className="panel-root">
      <div className="peek">
        <div className="peek-h"><ServiceIcon type={loc.inst.type} name={instanceName(loc.inst)} status={snap.statuses[loc.inst.id]} size={18} /><b>{instanceName(loc.inst)}</b><span>{loc.ws.name}</span><small>Live snapshot</small></div>
        <img src={peek.image} alt={`Snapshot of ${instanceName(loc.inst)}`} />
      </div>
    </div>
  );
}

/** Menu-bar / tray mini view (FR-X25). */
export function TrayPanel({ snap }: { snap: AppSnapshot }) {
  const open = (workspaceId: string, instanceId: string) => {
    void act('selectInstance', { workspaceId, instanceId });
    void act('showMainWindow');
  };
  return (
    <div className="tray">
      <div className="pop-h" style={{ padding: '4px 4px 8px' }}>
        <Brand size={20} /><b>Extrovert</b>
        <span className="sctrl" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>Do Not Disturb <Switch label="Do Not Disturb" checked={snap.settings.dnd} onChange={(v) => act('updateSettings', { patch: { dnd: v } })} /></span>
      </div>
      {snap.workspaces.map((w) => {
        const unread = orderedInstances(w.instances).filter((i) => (snap.statuses[i.id]?.unread ?? 0) > 0);
        const n = workspaceUnread(w, snap.statuses);
        return (
          <div key={w.id} className="tray-ws">
            <div className="tray-wsh"><Avatar ws={w} size={18} />&nbsp;<b>{w.name}</b>{n > 0 && <em className="badge inline">{n}</em>}</div>
            <div className="tray-svcs">
              {unread.length ? unread.map((i) => (
                <button key={i.id} onClick={() => open(w.id, i.id)} title={instanceName(i)}><ServiceIcon type={i.type} name={instanceName(i)} status={snap.statuses[i.id]} size={20} /><b>{snap.statuses[i.id]!.unread}</b></button>
              )) : <small className="muted">All caught up</small>}
            </div>
          </div>
        );
      })}
      {snap.notifications.length > 0 && <div className="pop-h" style={{ padding: '10px 4px 4px', borderTop: '1px solid var(--line)', marginTop: 6 }}><small className="muted">Latest</small></div>}
      {snap.notifications.slice(0, 5).map((n) => {
        const loc = findInstance(snap, n.instanceId);
        return (
          <button key={n.id} className="tray-n" onClick={() => { void act('openNotification', { id: n.id }); void act('showMainWindow'); }}>
            {loc ? <ServiceIcon type={loc.inst.type} name={instanceName(loc.inst)} status={snap.statuses[loc.inst.id]} size={16} /> : <span />}<b>{n.sender}</b><span>{n.body}</span>
          </button>
        );
      })}
      <button className="btn primary full" style={{ marginTop: 10 }} onClick={() => act('showMainWindow')}>Open Extrovert</button>
    </div>
  );
}
