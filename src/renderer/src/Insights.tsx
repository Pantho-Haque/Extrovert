/** Time insights (FR-X14) and the task manager (FR-X19). */
import { useEffect, useState } from 'react';
import { instanceName } from '../../core/workspaces/model';
import type { AppSnapshot, InstanceMetrics } from '../../shared/ipc';
import { Icon } from './icons';
import { act, findInstance, fmtMinutes } from './lib';
import { Modal, ServiceIcon, Switch } from './ui';

export function Insights({ snap, onClose }: { snap: AppSnapshot; onClose: () => void }) {
  const [tab, setTab] = useState<'today' | 'week'>('today');
  const rows = Object.entries(snap.usage.today)
    .map(([instanceId, seconds]) => ({ instanceId, seconds, loc: findInstance(snap, instanceId) }))
    .filter((r) => r.loc && r.seconds >= 30)
    .sort((a, b) => b.seconds - a.seconds);
  const total = rows.reduce((n, r) => n + r.seconds, 0);
  const max = Math.max(1, ...rows.map((r) => r.seconds));
  const perWs = snap.workspaces.map((w) => ({ w, s: rows.filter((r) => r.loc!.ws.id === w.id).reduce((n, r) => n + r.seconds, 0) })).filter((x) => x.s > 0);
  const weekMax = Math.max(1, ...snap.usage.week.map((d) => d.seconds));
  const weekAvg = snap.usage.week.reduce((n, d) => n + d.seconds, 0) / 7;

  return (
    <Modal title="Time insights" wide onClose={onClose}>
      <div className="seg">
        <button className={tab === 'today' ? 'on' : ''} onClick={() => setTab('today')}>Today</button>
        <button className={tab === 'week' ? 'on' : ''} onClick={() => setTab('week')}>This week</button>
      </div>
      {tab === 'today' ? (
        <>
          <div className="ins-top">
            <div><small>Today</small><h2>{fmtMinutes(total)}</h2></div>
            {perWs.map(({ w, s }) => <div key={w.id} className="ins-ws"><span className="dotc" style={{ background: w.color }} />{w.name}<b>{fmtMinutes(s)}</b></div>)}
          </div>
          {rows.length === 0 && <p className="empty">Nothing tracked yet today. Time counts while you use a service in Extrovert.</p>}
          <div className="ins-rows">
            {rows.map(({ instanceId, seconds, loc }) => {
              const budget = snap.settings.feedGuard.enabled ? snap.settings.feedGuard.budgets[loc!.inst.type] : undefined;
              const over = budget !== undefined && seconds >= budget * 60;
              return (
                <div key={instanceId} className="ins-row">
                  <ServiceIcon type={loc!.inst.type} look={loc!.inst} name={instanceName(loc!.inst)} status={snap.statuses[instanceId]} size={26} />
                  <div className="ins-name"><b>{instanceName(loc!.inst)}</b><small>{loc!.ws.name}</small></div>
                  <div className="ins-bar">
                    <span className={over ? 'over' : ''} style={{ width: `${(seconds / max) * 100}%` }} />
                    {budget !== undefined && budget * 60 <= max && <i className="budget" style={{ left: `${((budget * 60) / max) * 100}%` }} title={`Budget ${budget} min`} />}
                  </div>
                  <b className={`ins-v ${over ? 'over-t' : ''}`}>{fmtMinutes(seconds)}{budget !== undefined && <small>/ {budget} min</small>}</b>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="ins-top"><div><small>This week · daily average</small><h2>{fmtMinutes(weekAvg)}</h2></div></div>
          <div className="week">
            {snap.usage.week.map((d) => (
              <div key={d.day} className="wk">
                <span style={{ height: `${(d.seconds / weekMax) * 100}%` }} title={fmtMinutes(d.seconds)} />
                <small>{new Date(`${d.day}T12:00:00`).toLocaleDateString([], { weekday: 'short' })}</small>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="note">
        <Icon name="clock" size={16} />
        <p><b>How time is counted:</b> only while the Extrovert window is focused, the service is on screen, <i>and</i> you're active (keyboard or mouse in the last 60 s) or it's playing video or audio. It stops when you switch apps, minimize, lock the screen or switch service. Stored only on this computer.</p>
      </div>
    </Modal>
  );
}

export function TaskManager({ snap, onClose }: { snap: AppSnapshot; onClose: () => void }) {
  const [metrics, setMetrics] = useState<InstanceMetrics[]>([]);
  useEffect(() => {
    const load = () => void act('metrics').then(setMetrics);
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, []);
  const rows = snap.workspaces.flatMap((ws) => ws.instances.filter((i) => i.enabled).map((inst) => ({ ws, inst, st: snap.statuses[inst.id], m: metrics.find((x) => x.instanceId === inst.id) })))
    .sort((a, b) => (b.m?.memoryMB ?? 0) - (a.m?.memoryMB ?? 0));
  const total = metrics.reduce((n, m) => n + m.memoryMB, 0);
  const maxMem = Math.max(400, ...metrics.map((m) => m.memoryMB));
  const label = (state?: string) => ({ live: 'Live', loading: 'Loading', sleeping: 'Sleeping', signedout: 'Signed out', offline: 'Offline', crashed: 'Crashed' })[state ?? 'sleeping'] ?? state;

  return (
    <Modal title="Task manager" wide onClose={onClose}>
      <div className="tm-top">
        <div><small>Memory used by services</small><h2>{total >= 1024 ? `${(total / 1024).toFixed(1)} GB` : `${total} MB`}</h2></div>
        <label className="sctrl">Smart sleep when memory is low <Switch label="Smart hibernation" checked={snap.settings.smartHibernation} onChange={(v) => act('updateSettings', { patch: { smartHibernation: v } })} /></label>
      </div>
      <table>
        <thead><tr><th>Service</th><th>Workspace</th><th>Status</th><th>Memory</th><th>CPU</th><th /></tr></thead>
        <tbody>
          {rows.map(({ ws, inst, st, m }) => (
            <tr key={inst.id}>
              <td className="svc-cell"><ServiceIcon type={inst.type} look={inst} name={instanceName(inst)} status={st} size={22} />{instanceName(inst)}</td>
              <td><span className="dotc" style={{ background: ws.color }} />{ws.name}</td>
              <td><span className={`st st-${ws.suspended ? 'paused' : st?.state ?? 'sleeping'}`}>{ws.suspended ? 'Paused' : label(st?.state)}</span></td>
              <td>{m ? <><span className="membar"><span style={{ width: `${(m.memoryMB / maxMem) * 100}%` }} /></span>{m.memoryMB} MB</> : '–'}</td>
              <td>{m ? `${m.cpu}%` : '–'}</td>
              <td className="tm-a">
                {m && <button className="btn sm" onClick={() => act('sleep', { workspaceId: ws.id, instanceId: inst.id })}>Sleep</button>}
                <button className="btn sm" onClick={() => (m ? act('reload', { workspaceId: ws.id, instanceId: inst.id }) : act('wake', { workspaceId: ws.id, instanceId: inst.id }))}>{m ? 'Reload' : 'Wake'}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
