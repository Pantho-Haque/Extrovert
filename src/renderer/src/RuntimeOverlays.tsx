/** Overlays raised by the app itself rather than by a click: lock, prompts, feed guard, recap, What's new. */
import { useState } from 'react';
import { groupByPerson } from '../../core/notifications/rules';
import { instanceName } from '../../core/workspaces/model';
import type { AppSnapshot } from '../../shared/ipc';
import { Icon } from './icons';
import { act, findInstance } from './lib';
import { Brand, Modal, PersonAvatar, ServiceIcon } from './ui';

export function LockScreen({ snap }: { snap: AppSnapshot }) {
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const hasPin = !!snap.settings.appLock.pinHash;
  const touchId = snap.runtime.touchId;
  const tryUnlock = async (input: { pin?: string; touchId?: boolean }) => {
    const { ok } = await act('unlock', input);
    if (!ok) {
      setWrong(true);
      setPin('');
    }
  };
  return (
    <div className="lock">
      {snap.runtime.lockImage && <div className="lock-bg" style={{ backgroundImage: `url(${snap.runtime.lockImage})` }} />}
      <div className="lock-card">
        <Brand size={52} />
        <h2>Extrovert is locked</h2>
        <p>Notifications and sounds are paused until you unlock.</p>
        {hasPin ? (
          <>
            <div className="pin">{[0, 1, 2, 3].map((k) => <i key={k} className={k < pin.length ? 'on' : ''} />)}</div>
            <input className="pin-in" type="password" inputMode="numeric" maxLength={8} autoFocus placeholder="Enter your PIN" value={pin}
              onChange={(e) => {
                setWrong(false);
                const v = e.target.value.replace(/\D/g, '');
                setPin(v);
                if (v.length >= 4) void tryUnlock({ pin: v });
              }} />
            {wrong && <p className="err">That PIN isn't right.</p>}
            {touchId && <button className="btn" onClick={() => tryUnlock({ touchId: true })}><Icon name="lock" size={16} /> Unlock with Touch ID</button>}
          </>
        ) : (
          <button className="btn primary" autoFocus onClick={() => tryUnlock({})} style={{ marginTop: 18 }}><Icon name="lock" size={16} /> Unlock</button>
        )}
      </div>
    </div>
  );
}

export function PermissionPrompt({ snap }: { snap: AppSnapshot }) {
  const p = snap.runtime.permissionPrompt!;
  const loc = findInstance(snap, p.instanceId);
  const name = loc ? `${instanceName(loc.inst)} (${loc.ws.name})` : 'A service';
  return (
    <div className="backdrop">
      <div className="modal" role="alertdialog" aria-label="Permission request">
        <div className="modal-b" style={{ textAlign: 'center', paddingTop: 26 }}>
          {loc && <ServiceIcon type={loc.inst.type} name={instanceName(loc.inst)} status={snap.statuses[loc.inst.id]} size={48} />}
          <h3>{name} wants to use your {p.what}</h3>
          <p className="muted">Extrovert remembers your answer for this service. You can change it any time in Settings → Privacy.</p>
          <div className="modal-f" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={() => act('answerPermission', { id: p.id, allow: false })}>Don't allow</button>
            <button className="btn primary" autoFocus onClick={() => act('answerPermission', { id: p.id, allow: true })}>Allow</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScreenPicker({ snap }: { snap: AppSnapshot }) {
  const picker = snap.runtime.screenPicker!;
  const loc = findInstance(snap, picker.instanceId);
  return (
    <Modal title={`Choose what ${loc ? instanceName(loc.inst) : 'the service'} can see`} wide onClose={() => act('pickScreen', { sourceId: null })}>
      {snap.settings.shareShield && <p className="hint"><Icon name="shield" size={14} /> Screen-share shield is on: notification previews and your other workspaces are hidden while you share.</p>}
      <div className="sources">
        {picker.sources.map((s) => (
          <button key={s.id} className="source" onClick={() => act('pickScreen', { sourceId: s.id })}>
            <img src={s.thumbnail} alt="" />
            <span>{s.name}</span>
          </button>
        ))}
      </div>
      {picker.sources.length === 0 && <p className="empty">Nothing to share. On macOS, allow screen recording for Extrovert in System Settings → Privacy & Security.</p>}
    </Modal>
  );
}

export function FeedGuard({ snap }: { snap: AppSnapshot }) {
  const fg = snap.runtime.feedGuard!;
  const loc = findInstance(snap, fg.instanceId);
  const pct = fg.budgetMin ? Math.min(100, (fg.todayMin / fg.budgetMin) * 100) : 100;
  return (
    <div className="fg">
      <div className="fg-card" role="dialog" aria-label="Still want to scroll?">
        <div className="ring" style={{ ['--p' as string]: pct }}>{loc && <ServiceIcon type={loc.inst.type} name={instanceName(loc.inst)} status={snap.statuses[fg.instanceId]} size={40} />}</div>
        <h2>Still want to scroll?</h2>
        <p>You've spent <b>{fg.todayMin} min</b> on {loc ? instanceName(loc.inst) : 'this feed'} today{fg.budgetMin !== undefined ? <>. Your daily budget is <b>{fg.budgetMin} min</b></> : ''}.</p>
        <small>Messaging is never limited. Feed guard is optional; change it in Settings → Wellbeing.</small>
        <div className="fg-a">
          <button className="btn" onClick={() => act('feedGuard', { choice: 'continue' })}>Continue 10 more min</button>
          <button className="btn primary" onClick={() => act('feedGuard', { choice: 'break' })}><Icon name="coffee" size={16} /> Take a break</button>
        </div>
      </div>
    </div>
  );
}

export function Recap({ snap }: { snap: AppSnapshot }) {
  const { since, until } = snap.runtime.recap!;
  const arrived = snap.notifications.filter((n) => n.at >= since && n.at <= until);
  const mins = Math.round((until - since) / 60000);
  const away = mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`;
  const close = () => act('dismissRecap');
  return (
    <Modal title="While you were away" onClose={close}>
      <div className="recap-top"><Icon name="coffee" size={20} /><div><b>Welcome back. You were away for {away}.</b><p>Here's who reached out, grouped by person. Click anyone to open that conversation.</p></div></div>
      {snap.workspaces.map((w) => {
        const people = groupByPerson(arrived.filter((n) => n.workspaceId === w.id), snap.settings.personLinks);
        if (!people.length) return null;
        return (
          <div key={w.id} className="recap-ws">
            <div className="recap-wsh"><span className="dotc" style={{ background: w.color }} /><b>{w.name}</b><small>{people.reduce((n, p) => n + p.entries.length, 0)} new</small></div>
            {people.map((p) => (
              <div key={p.person} className="recap-row" onClick={() => { void close(); void act('openNotification', { id: p.entries[0]!.id }); }}>
                <PersonAvatar name={p.person} size={28} />
                <b>{p.person}</b>
                <span className="recap-apps">{[...new Set(p.entries.map((e) => e.instanceId))].map((id) => { const loc = findInstance(snap, id); return loc ? <ServiceIcon key={id} type={loc.inst.type} status={snap.statuses[id]} size={16} /> : null; })}</span>
                <small>{p.entries.length} · {p.entries[0]!.body}</small>
              </div>
            ))}
          </div>
        );
      })}
      <div className="modal-f">
        <button className="btn" onClick={close}>Dismiss</button>
        <button className="btn primary" onClick={() => { void close(); void act('nextUnread'); }}>Start catching up</button>
      </div>
    </Modal>
  );
}

const CHANGES: [Parameters<typeof Icon>[0]['name'], string, string][] = [
  ['users', 'People view', 'See who is waiting on you, grouped by person across platforms.'],
  ['clock', 'Snooze to the exact chat', 'Snoozed notifications reopen the exact conversation.'],
  ['shield', 'Screen-share shield', 'Previews hide automatically while you present.'],
  ['zap', 'Faster startup', 'Messaging apps load first, everything else follows.'],
];

export function WhatsNew({ snap, onFeedback }: { snap: AppSnapshot; onFeedback: () => void }) {
  const close = () => act('dismissWhatsNew');
  return (
    <Modal title={`What's new in ${snap.runtime.whatsNew}`} onClose={close}>
      <div className="wn">{CHANGES.map(([icon, t, d]) => <div key={t} className="wn-i"><span><Icon name={icon} size={18} /></span><div><b>{t}</b><p>{d}</p></div></div>)}</div>
      <div className="modal-f">
        <button className="btn" onClick={() => { void close(); onFeedback(); }}>Send feedback</button>
        <button className="btn primary" onClick={close}>Got it</button>
      </div>
    </Modal>
  );
}

export function Feedback({ snap, onClose }: { snap: AppSnapshot; onClose: () => void }) {
  const [text, setText] = useState('');
  const info = `Extrovert ${snap.version} · ${snap.platform} · ${snap.workspaces.length} workspaces · ${snap.workspaces.reduce((n, w) => n + w.instances.length, 0)} services`;
  return (
    <Modal title="Send feedback" onClose={onClose}>
      <p className="muted">Nothing is sent automatically. Review everything, then open it as a GitHub issue or copy it.</p>
      <textarea className="field" autoFocus placeholder="What happened? What did you expect?" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="note"><Icon name="file" size={16} /><p><b>System info that will be attached:</b><br /><code>{info}</code></p></div>
      <div className="modal-f">
        <button className="btn" onClick={() => act('copyText', { text: `${text}\n\n---\n${info}` })}>Copy to clipboard</button>
        <button className="btn primary" disabled={!text.trim()} onClick={() => { void act('sendFeedback', { text }); onClose(); }}>Open as GitHub issue</button>
      </div>
    </Modal>
  );
}

export function SigningIn() {
  return (
    <div className="backdrop">
      <div className="modal" style={{ width: 420 }}>
        <div className="modal-b" style={{ textAlign: 'center', padding: 28 }}>
          <div className="spinner" />
          <h3>Finish signing in with Google in your browser</h3>
          <p className="muted">A new tab opened in your browser. Pick the account to add. Its workspace appears here as soon as you're done.</p>
          <button className="btn" onClick={() => act('cancelSignIn')}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
