/** Settings (FR-P01) with every section from the prototype, wired to real settings and actions. */
import { Fragment, useState, type ReactNode } from 'react';
import { formatKeys, keyOf, SHORTCUTS } from '../../core/guide/registry';
import { serviceDef } from '../../core/services/catalog';
import { instanceName, WORKSPACE_COLORS } from '../../core/workspaces/model';
import type { ActionPayload, AppSnapshot } from '../../shared/ipc';
import type { DevicePermission, Instance, Settings as SettingsT, Workspace } from '../../shared/types';
import { Icon, type IconName } from './icons';
import { LookPicker } from './LookPicker';
import { act, isMac, timeAgo } from './lib';
import type { Overlay } from './Shell';
import { Avatar, Brand, Modal, Row, ServiceIcon, Switch } from './ui';

export type SectionId = 'account' | 'services' | 'notifications' | 'privacy' | 'wellbeing' | 'appearance' | 'shortcuts' | 'updates' | 'import' | 'about';

const SECTIONS: [SectionId, string, IconName][] = [
  ['account', 'Accounts & workspaces', 'users'], ['services', 'Services', 'globe'], ['notifications', 'Notifications', 'bell'],
  ['privacy', 'Privacy & security', 'shield'], ['wellbeing', 'Wellbeing', 'coffee'], ['appearance', 'Appearance', 'sun'],
  ['shortcuts', 'Shortcuts', 'type'], ['updates', 'Updates', 'download'], ['import', 'Import & export', 'upload'], ['about', 'About', 'compass'],
];

type Ctx = { snap: AppSnapshot; set: (patch: Partial<SettingsT>) => void; onOpen: (o: Overlay) => void };

export function Settings({ snap, section, onClose, onOpen }: { snap: AppSnapshot; section?: SectionId | undefined; onClose: () => void; onOpen: (o: Overlay) => void }) {
  const [current, setCurrent] = useState<SectionId>(section ?? 'account');
  const ctx: Ctx = { snap, set: (patch) => void act('updateSettings', { patch }), onOpen };
  const Body = BODIES[current];
  return (
    <Modal title="Settings" wide className="settings-modal" onClose={onClose}>
      <div className="settings">
        <nav>{SECTIONS.map(([id, label, icon]) => <button key={id} className={id === current ? 'on' : ''} onClick={() => setCurrent(id)}><Icon name={icon} size={16} /> {label}</button>)}</nav>
        <div className="set-body"><h4>{SECTIONS.find((s) => s[0] === current)![1]}</h4><Body {...ctx} /></div>
      </div>
    </Modal>
  );
}

const BODIES: Record<SectionId, (c: Ctx) => ReactNode> = {
  account: ({ snap, set }) => (
    <>
      {snap.workspaces.map((w) => <WorkspaceCard key={w.id} w={w} />)}
      <button className="btn" onClick={() => act('signIn')} disabled={snap.runtime.signingIn}><Icon name="plus" size={15} /> Add Google account</button>
      <h5>Background</h5>
      <Row title="Keep other workspaces running" desc="Their badges stay live. Turn off to save memory; they load when you open them.">
        <Switch label="Keep running" checked={snap.settings.keepBackgroundRunning} onChange={(v) => set({ keepBackgroundRunning: v })} />
      </Row>
      <h5>Work hours</h5>
      <p className="muted">Outside its hours a workspace is muted (its badges still update). VIPs always get through.</p>
      {snap.workspaces.map((w) => <WorkHoursRow key={w.id} w={w} />)}
      <h5>Network <span className="tag">Advanced</span></h5>
      {snap.workspaces.map((w) => <ProxyRow key={w.id} w={w} />)}
      <h5>Sync <span className="tag">Coming later</span></h5>
      <Row title="Sync settings through your Google Drive" desc="Planned (FR-W08). For now, use Import & export to move your setup."><Switch label="Sync" checked={false} onChange={() => undefined} /></Row>
    </>
  ),

  services: ({ snap }) => <ServicesSection snap={snap} />,

  notifications: ({ snap, set }) => {
    const s = snap.settings;
    return (
      <>
        <Row title="Do Not Disturb" desc="Badges keep updating. Alerts and sounds pause. VIPs still get through."><Switch label="Do Not Disturb" checked={s.dnd} onChange={(v) => set({ dnd: v })} /></Row>
        <Row title="Digest mode" desc="Hold non-VIP alerts and deliver them together.">
          <Switch label="Digest" checked={s.digest.enabled} onChange={(v) => set({ digest: { ...s.digest, enabled: v } })} />
          <select value={s.digest.intervalMin} onChange={(e) => set({ digest: { ...s.digest, intervalMin: Number(e.target.value) } })}>
            {[15, 30, 60, 120, 240].map((m) => <option key={m} value={m}>Every {m >= 60 ? `${m / 60} hour${m > 60 ? 's' : ''}` : `${m} min`}</option>)}
          </select>
        </Row>
        <Row title="Show message previews" desc="Sender and text in notifications."><Switch label="Previews" checked={s.previews} onChange={(v) => set({ previews: v })} /></Row>
        <Row title="While-you-were-away recap" desc="After being away for at least">
          <Switch label="Away recap" checked={s.awayRecap.enabled} onChange={(v) => set({ awayRecap: { ...s.awayRecap, enabled: v } })} />
          <select value={s.awayRecap.afterMin} onChange={(e) => set({ awayRecap: { ...s.awayRecap, afterMin: Number(e.target.value) } })}>{[5, 15, 30, 60].map((m) => <option key={m} value={m}>{m} min</option>)}</select>
        </Row>
        <Row title="Keep notification history for" desc="Stored on this computer only.">
          <select value={s.historyDays} onChange={(e) => set({ historyDays: Number(e.target.value) })}>{[7, 30, 90].map((d) => <option key={d} value={d}>{d} days</option>)}</select>
        </Row>
        <h5>VIP people</h5>
        <p className="muted">Messages from these people get through Do Not Disturb, digests and work hours on every platform, with a distinct sound. Tip: star someone in the notification center.</p>
        <ChipList items={s.vips} placeholder="+ Add a name" onChange={(vips) => set({ vips })} />
        <h5>Saved replies <kbd>{keyOf('replies', isMac)}</kbd></h5>
        <Replies replies={s.replies} onChange={(replies) => set({ replies })} />
      </>
    );
  },

  privacy: ({ snap, set }) => <PrivacySection snap={snap} set={set} />,

  wellbeing: ({ snap, set, onOpen }) => {
    const fg = snap.settings.feedGuard;
    return (
      <>
        <Row title="Time insights" desc="Counts only while the window is focused, the service is on screen and you're active.">
          <Switch label="Time insights" checked={snap.settings.usageTracking} onChange={(v) => set({ usageTracking: v })} />
          <button className="btn sm" onClick={() => onOpen({ kind: 'insights' })}>Open</button>
        </Row>
        <Row title="Feed guard" desc="A gentle check-in when you pass a daily budget on a feed, or after a long scroll. Messaging is never limited.">
          <Switch label="Feed guard" checked={fg.enabled} onChange={(v) => set({ feedGuard: { ...fg, enabled: v } })} />
        </Row>
        <h5>Daily budgets</h5>
        {(['facebook', 'instagram', 'linkedin'] as const).map((t) => (
          <Row key={t} title={<><ServiceIcon type={t} size={20} /> {serviceDef(t).name}</>}>
            <input className="field num" type="number" min={5} max={600} value={fg.budgets[t] ?? 30} onChange={(e) => set({ feedGuard: { ...fg, budgets: { ...fg.budgets, [t]: Math.max(5, Number(e.target.value) || 5) } } })} /> min / day
          </Row>
        ))}
        <Row title="Check in after continuous scrolling for">
          <select value={fg.nudgeAfterMin} onChange={(e) => set({ feedGuard: { ...fg, nudgeAfterMin: Number(e.target.value) } })}>{[10, 15, 30, 45].map((m) => <option key={m} value={m}>{m} min</option>)}</select>
        </Row>
      </>
    );
  },

  appearance: ({ snap, set }) => (
    <>
      <Row title="Theme" desc="Applies to Extrovert itself. Services keep their own themes.">
        <div className="seg inline">{(['light', 'dark', 'system'] as const).map((t) => <button key={t} className={snap.settings.theme === t ? 'on' : ''} onClick={() => set({ theme: t })}>{t[0]!.toUpperCase() + t.slice(1)}</button>)}</div>
      </Row>
      <Row title="Language" desc="Extrovert is translation-ready; more languages are coming."><select value="en" onChange={() => undefined}><option value="en">English</option></select></Row>
      <Row title="Zen mode" desc="Hide the sidebar so the service fills the window."><kbd>{keyOf('zen', isMac)}</kbd></Row>
      <Row title="Launch at login"><Switch label="Launch at login" checked={snap.settings.launchAtLogin} onChange={(v) => set({ launchAtLogin: v })} /></Row>
    </>
  ),

  shortcuts: ({ onOpen }) => (
    <>
      <div className="keys">{SHORTCUTS.map((k) => <div key={k.id}><kbd>{formatKeys(k.keys, isMac)}</kbd><span>{k.label}</span></div>)}</div>
      <p style={{ marginTop: 14 }}><button className="btn" onClick={() => onOpen({ kind: 'guide' })}><Icon name="command" size={15} /> All shortcuts & features</button></p>
    </>
  ),

  updates: ({ snap, set, onOpen }) => (
    <>
      <Row title="Current version" desc={`Extrovert ${snap.version}${snap.runtime.update ? ` · ${snap.runtime.update.version} ${snap.runtime.update.ready ? 'ready to install' : 'downloading'}` : ''}`}>
        {snap.runtime.update?.ready ? <button className="btn sm primary" onClick={() => act('installUpdate')}>Restart & update</button> : <button className="btn sm" onClick={() => act('checkUpdates')}>Check for updates</button>}
      </Row>
      <Row title="Update channel" desc="Beta gets new features earlier.">
        <div className="seg inline">{(['stable', 'beta'] as const).map((c) => <button key={c} className={snap.settings.updates.channel === c ? 'on' : ''} onClick={() => set({ updates: { ...snap.settings.updates, channel: c } })}>{c === 'stable' ? 'Stable' : 'Beta'}</button>)}</div>
      </Row>
      <Row title="Check automatically" desc="At startup and every 6 hours."><Switch label="Auto update" checked={snap.settings.updates.autoCheck} onChange={(v) => set({ updates: { ...snap.settings.updates, autoCheck: v } })} /></Row>
      <div className="note"><Icon name="shield" size={16} /><p>Updates come straight from GitHub Releases. The check sends no personal data.</p></div>
      <p style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        <button className="btn" onClick={() => act('openExternal', { url: 'https://github.com/Pantho-Haque/Extrovert/releases' })}>Release notes</button>
        <button className="btn" onClick={() => onOpen({ kind: 'feedback' })}>Report a problem</button>
      </p>
    </>
  ),

  import: ({ snap, onOpen }) => <ImportSection snap={snap} onOpen={onOpen} />,

  about: ({ snap }) => (
    <div className="about">
      <Brand size={64} />
      <h2>Extrovert</h2>
      <p className="muted">All your communities. One space.</p>
      <small className="muted">Version {snap.version}</small>
      <div className="note"><Icon name="shield" size={16} /><p>No analytics. No telemetry. No server. Your logins stay on this computer, and services run exactly as their real websites.</p></div>
    </div>
  ),
};

function WorkspaceCard({ w }: { w: Workspace }) {
  const [name, setName] = useState(w.name);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="ws-card">
      <Avatar ws={w} size={36} />
      <div>
        <input className="inline-in" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== w.name && act('updateWorkspace', { workspaceId: w.id, patch: { name: name.trim() } })} aria-label="Workspace name" />
        <small>{w.email} · {w.instances.length} service{w.instances.length === 1 ? '' : 's'}{w.suspended ? ' · paused' : ''}</small>
      </div>
      <div className="swatches">{WORKSPACE_COLORS.slice(0, 6).map((c) => <button key={c} aria-label={`Color ${c}`} className={c === w.color ? 'on' : ''} style={{ ['--c' as string]: c }} onClick={() => act('updateWorkspace', { workspaceId: w.id, patch: { color: c } })} />)}</div>
      {confirm ? (
        <span className="sctrl">
          <small>Deletes this workspace's service logins too.</small>
          <button className="btn sm" onClick={() => setConfirm(false)}>Cancel</button>
          <button className="btn sm danger-t" onClick={() => act('signOut', { workspaceId: w.id })}>Sign out</button>
        </span>
      ) : (
        <span className="sctrl">
          <button className="btn sm" onClick={() => act('updateWorkspace', { workspaceId: w.id, patch: { suspended: !w.suspended } })}>{w.suspended ? 'Resume' : 'Pause'}</button>
          <button className="btn sm danger-t" onClick={() => setConfirm(true)}>Sign out…</button>
        </span>
      )}
    </div>
  );
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
function WorkHoursRow({ w }: { w: Workspace }) {
  const wh = w.workHours;
  const save = (patch: Partial<Workspace['workHours']>) => act('updateWorkspace', { workspaceId: w.id, patch: { workHours: { ...wh, ...patch } } });
  return (
    <Row title={<><span className="dotc" style={{ background: w.color }} />{w.name}</>}>
      <Switch label={`Work hours for ${w.name}`} checked={wh.enabled} onChange={(v) => save({ enabled: v })} />
      <span className="chips" style={{ margin: 0 }}>{DAYS.map((d, k) => <button key={k} className={`chip ${wh.days.includes(k) ? 'on' : ''}`} disabled={!wh.enabled} onClick={() => save({ days: wh.days.includes(k) ? wh.days.filter((x) => x !== k) : [...wh.days, k].sort() })}>{d}</button>)}</span>
      <input className="field" type="time" value={wh.start} disabled={!wh.enabled} onChange={(e) => save({ start: e.target.value })} /> –
      <input className="field" type="time" value={wh.end} disabled={!wh.enabled} onChange={(e) => save({ end: e.target.value })} />
    </Row>
  );
}

function ProxyRow({ w }: { w: Workspace }) {
  const [value, setValue] = useState(w.proxy ?? '');
  return (
    <Row title={`Proxy for “${w.name}”`} desc="Only this workspace's traffic goes through it. Leave empty for your normal connection.">
      <input className="field" placeholder="e.g. proxy.company.com:8080" value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => value !== (w.proxy ?? '') && act('updateWorkspace', { workspaceId: w.id, patch: { proxy: value.trim() } })} />
    </Row>
  );
}

function ServicesSection({ snap }: { snap: AppSnapshot }) {
  const [wsId, setWsId] = useState(snap.activeWorkspaceId ?? snap.workspaces[0]?.id ?? '');
  const [styling, setStyling] = useState<string | null>(null);
  const ws = snap.workspaces.find((w) => w.id === wsId);
  if (!ws) return <p className="empty">No workspaces yet.</p>;
  const set = (inst: Instance, patch: ActionPayload<'updateInstance'>['patch']) => act('updateInstance', { workspaceId: ws.id, instanceId: inst.id, patch });
  return (
    <>
      {snap.workspaces.length > 1 && <div className="chips">{snap.workspaces.map((w) => <button key={w.id} className={`chip ${w.id === wsId ? 'on' : ''}`} onClick={() => setWsId(w.id)}>{w.name}</button>)}</div>}
      {ws.instances.length === 0 && <p className="empty">No services in {ws.name} yet.</p>}
      <table className="svc-t">
        <colgroup><col style={{ width: '30%' }} /><col style={{ width: '20%' }} /><col /><col /><col /><col /><col /><col style={{ width: 40 }} /></colgroup>
        <thead><tr><th>Service</th><th>Badge signal</th><th>On</th><th>Badge</th><th>Alerts</th><th>Sound</th><th title="Play videos automatically (feeds only)">Videos</th><th /></tr></thead>
        <tbody>
          {ws.instances.map((inst) => {
            const st = snap.statuses[inst.id];
            const icon = <ServiceIcon type={inst.type} look={inst} name={instanceName(inst)} status={st} size={24} />;
            return (
              <Fragment key={inst.id}>
              <tr>
                <td className="svc-cell">{inst.type === 'custom' ? <button className="look-btn" title="Change icon & color" aria-expanded={styling === inst.id} onClick={() => setStyling(styling === inst.id ? null : inst.id)}>{icon}</button> : icon}<div><NameField inst={inst} onSave={(label) => set(inst, { label })} /><small>{inst.url ? new URL(inst.url).host : new URL(serviceDef(inst.type).url).host}</small></div></td>
                <td><Health inst={inst} state={st?.state} /></td>
                <td><Switch label="Enabled" checked={inst.enabled} onChange={(v) => set(inst, { enabled: v })} /></td>
                <td><Switch label="Badge" checked={inst.badge} onChange={(v) => set(inst, { badge: v })} /></td>
                <td><Switch label="Alerts" checked={inst.alerts} onChange={(v) => set(inst, { alerts: v })} /></td>
                <td><Switch label="Sound" checked={inst.sound} onChange={(v) => set(inst, { sound: v })} /></td>
                <td>{serviceDef(inst.type).kind === 'feed' ? <Switch label="Autoplay videos" checked={inst.autoplay} onChange={(v) => set(inst, { autoplay: v })} /> : <small className="muted">–</small>}</td>
                <td><button className="icon-btn" title="More (zoom, pin, log out, remove)" onClick={() => act('instanceMenu', { workspaceId: ws.id, instanceId: inst.id })}><Icon name="more" size={16} /></button></td>
              </tr>
              {styling === inst.id && (
                <tr className="look-row"><td colSpan={8}>
                  {/* An empty value clears the field: back to the site's own icon. */}
                  <LookPicker look={inst} url={inst.url} siteIcon={st?.icon ?? inst.siteIcon} onChange={(l) => set(inst, { icon: l.icon ?? '', color: l.color ?? '' })} />
                </td></tr>
              )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <div className="note"><Icon name="alert" size={16} /><p><b>Badge signal:</b> if a service stops reporting unread counts (for example after a redesign), Extrovert warns you here instead of silently showing 0.</p></div>
    </>
  );
}

function NameField({ inst, onSave }: { inst: Instance; onSave: (label: string) => void }) {
  const [v, setV] = useState(instanceName(inst));
  return <input className="inline-in" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v.trim() && v !== instanceName(inst) && onSave(v.trim())} aria-label="Service name" />;
}

/** FR-A08: warn when a signed-in service has sent no unread count or notification for 3 days. */
function Health({ inst, state }: { inst: Instance; state: string | undefined }) {
  if (state === 'signedout') return <span className="health warn"><Icon name="alert" size={12} /> Signed out</span>;
  if (!inst.lastSignalAt) return <span className="health idle">No signal yet</span>;
  const stale = Date.now() - inst.lastSignalAt > 3 * 86_400_000;
  return stale ? <span className="health warn" title="No unread count or notification for 3 days while loaded"><Icon name="alert" size={12} /> No signal for {timeAgo(inst.lastSignalAt)}</span>
    : <span className="health ok"><Icon name="check" size={12} /> OK · {timeAgo(inst.lastSignalAt)}</span>;
}

function PrivacySection({ snap, set }: { snap: AppSnapshot; set: Ctx['set'] }) {
  const [pin, setPin] = useState('');
  const lock = snap.settings.appLock;
  const cycle = (inst: Instance, ws: Workspace, perm: DevicePermission) => {
    const cur = inst.permissions[perm];
    const next = { ...inst.permissions };
    if (cur === undefined) next[perm] = true;
    else if (cur) next[perm] = false;
    else delete next[perm];
    void act('updateInstance', { workspaceId: ws.id, instanceId: inst.id, patch: { permissions: next } });
  };
  return (
    <>
      <Row title="App lock" desc={lock.pinHash ? 'Ask for your PIN (or Touch ID) when Extrovert opens or after being idle.' : 'Set a PIN of 4–8 digits to turn it on.'}>
        {lock.pinHash ? (
          <>
            <select value={lock.afterIdleMin} onChange={(e) => set({ appLock: { ...lock, afterIdleMin: Number(e.target.value) } })}>{[5, 10, 30, 60].map((m) => <option key={m} value={m}>Lock after {m} min idle</option>)}</select>
            <button className="btn sm danger-t" onClick={() => act('setPin', { pin: null })}>Turn off</button>
          </>
        ) : (
          <>
            <input className="field" type="password" inputMode="numeric" maxLength={8} placeholder="New PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} style={{ width: 110 }} />
            <button className="btn sm primary" disabled={pin.length < 4} onClick={() => { void act('setPin', { pin }); setPin(''); }}>Set PIN</button>
          </>
        )}
      </Row>
      <Row title="Panic key" desc="Instantly blur, mute and lock."><kbd>{keyOf('lock', isMac)}</kbd></Row>
      <Row title="Blur when idle" desc="Lock the window after 5 minutes without activity."><Switch label="Blur when idle" checked={snap.settings.blurOnIdle} onChange={(v) => set({ blurOnIdle: v })} /></Row>
      <Row title="Screen-share shield" desc="While you share your screen, hide notification previews and your other accounts."><Switch label="Screen-share shield" checked={snap.settings.shareShield} onChange={(v) => set({ shareShield: v })} /></Row>
      <Row title={<>Tracker blocking <span className="tag">Coming later</span></>} desc="Block third-party trackers per workspace (can't remove sponsored posts)."><Switch label="Tracker blocking" checked={false} onChange={() => undefined} /></Row>
      <h5>Permissions</h5>
      <p className="muted">What each service may use. Click to cycle: <b>Ask</b> → <b>Allowed</b> → <b>Blocked</b>.</p>
      <table className="perm">
        <thead><tr><th>Service</th><th><Icon name="camera" size={14} /> Camera</th><th><Icon name="mic" size={14} /> Microphone</th><th><Icon name="globe" size={14} /> Location</th></tr></thead>
        <tbody>
          {snap.workspaces.flatMap((ws) => ws.instances.map((inst) => (
            <tr key={inst.id}>
              <td className="svc-cell"><ServiceIcon type={inst.type} look={inst} name={instanceName(inst)} status={snap.statuses[inst.id]} size={20} />{instanceName(inst)} <small>{ws.name}</small></td>
              {(['camera', 'microphone', 'location'] as const).map((p) => {
                const v = inst.permissions[p];
                return <td key={p}><button className={`perm-p ${v === true ? 'on' : v === false ? 'off' : ''}`} onClick={() => cycle(inst, ws, p)}>{v === true ? 'Allowed' : v === false ? 'Blocked' : 'Ask'}</button></td>;
              })}
            </tr>
          )))}
        </tbody>
      </table>
      <h5>Data</h5>
      <button className="btn danger-t" onClick={() => act('signOutAll')}>Sign out of every account and delete all logins…</button>
    </>
  );
}

function ImportSection({ snap, onOpen }: { snap: AppSnapshot; onOpen: (o: Overlay) => void }) {
  const [msg, setMsg] = useState('');
  const ws = snap.workspaces.find((w) => w.id === snap.activeWorkspaceId);
  const errText = (e: unknown) => (e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e));
  return (
    <>
      {snap.platform === 'darwin' && (
        <Row title="Sign in with your browser" desc="Reuse logins from Arc, Chrome, Brave, Edge, Vivaldi or Opera for the current workspace.">
          <button className="btn sm" disabled={!ws} onClick={() => onOpen({ kind: 'browserImport' })}>Choose browser…</button>
        </Row>
      )}
      <Row title="Import from Ferdium" desc={`Adds your Ferdium services to ${ws?.name ?? 'this workspace'}. You only log in again.`}>
        <button className="btn sm" disabled={!ws} onClick={async () => {
          try {
            const r = ws && (await act('importFerdium', { workspaceId: ws.id }));
            if (r) setMsg(`Added ${r.added} service${r.added === 1 ? '' : 's'}${r.skipped.length ? `; skipped ${r.skipped.join(', ')}` : ''}.`);
          } catch (e) {
            setMsg(errText(e));
          }
        }}>Choose export file…</button>
      </Row>
      {msg && <div className="imp-ok"><Icon name="check" size={16} /><div>{msg}</div></div>}
      <Row title="Export configuration" desc="Workspaces, services and settings as JSON. Never includes logins or your PIN."><button className="btn sm" onClick={() => act('exportConfig')}>Export…</button></Row>
      <Row title="Import configuration" desc="Adds workspaces from an Extrovert export and applies its settings."><button className="btn sm" onClick={() => act('importConfig').catch((e) => setMsg(errText(e)))}>Import…</button></Row>
    </>
  );
}

function ChipList({ items, placeholder, onChange }: { items: string[]; placeholder: string; onChange: (v: string[]) => void }) {
  const [v, setV] = useState('');
  return (
    <div className="chips">
      {items.map((x) => <span key={x} className="chip on"><Icon name="star" size={11} /> {x} <b role="button" aria-label={`Remove ${x}`} onClick={() => onChange(items.filter((y) => y !== x))}>×</b></span>)}
      <input className="chip-in" placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => {
        if (e.key === 'Enter' && v.trim() && !items.includes(v.trim())) {
          onChange([...items, v.trim()]);
          setV('');
        }
      }} />
    </div>
  );
}

function Replies({ replies, onChange }: { replies: string[]; onChange: (v: string[]) => void }) {
  const [v, setV] = useState('');
  return (
    <>
      {replies.map((r, k) => (
        <div key={k} className="reply-row"><Icon name="msg" size={14} /><span>{r}</span><button className="icon-btn" aria-label="Delete reply" onClick={() => onChange(replies.filter((_, j) => j !== k))}><Icon name="x" size={14} /></button></div>
      ))}
      <form className="custom-url" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onChange([...replies, v.trim()]); setV(''); } }}>
        <Icon name="plus" size={14} /><input placeholder="New saved reply" value={v} onChange={(e) => setV(e.target.value)} /><button className="btn sm" disabled={!v.trim()}>Add</button>
      </form>
    </>
  );
}
