/** First launch (no accounts yet): welcome → Google sign-in → pick services → shortcuts. */
import { useState } from 'react';
import { formatKeys, SHORTCUTS, type ShortcutId } from '../../core/guide/registry';
import { catalog, parseCustomUrl } from '../../core/services/catalog';
import type { AppSnapshot } from '../../shared/ipc';
import type { ServiceType } from '../../shared/types';
import { BrowserImport } from './BrowserImport';
import { Icon } from './icons';
import { act, isMac } from './lib';
import { Brand, ServiceIcon } from './ui';

const FIRST_KEYS: ShortcutId[] = ['palette', 'nextUnread', 'service', 'workspace', 'peek', 'lock'];
const PICKABLE = catalog.filter((c) => c.group !== 'custom');
const DEFAULT_PICKS: ServiceType[] = ['facebook', 'messenger', 'whatsapp', 'instagram', 'linkedin', 'gmail'];

export function Onboarding({ snap, onDone, onStart }: { snap: AppSnapshot; onDone: () => void; onStart: () => void }) {
  const [step, setStep] = useState(snap.workspaces.length ? 2 : 1);
  const [error, setError] = useState('');
  const [picks, setPicks] = useState(new Set<ServiceType>(DEFAULT_PICKS));
  const [url, setUrl] = useState('');
  const [ferdium, setFerdium] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const ws = snap.workspaces.find((w) => w.id === snap.activeWorkspaceId) ?? snap.workspaces[0];

  const signIn = async () => {
    onStart();
    setError('');
    const r = await act('signIn');
    if (r.ok) setStep(2);
    else if (r.error) setError(r.error);
  };

  const finishPicks = async () => {
    if (!ws) return;
    const custom = parseCustomUrl(url);
    const items = [...picks].filter((t) => !ws.instances.some((i) => i.type === t)).map((type) => ({ type }));
    if (custom) items.push({ type: 'custom' as ServiceType, url: custom.url, label: custom.name } as { type: ServiceType });
    if (items.length) await act('addInstances', { workspaceId: ws.id, items });
    setStep(3);
  };

  const importFerdium = async () => {
    if (!ws) return;
    try {
      const r = await act('importFerdium', { workspaceId: ws.id });
      if (r) setFerdium(`Added ${r.added} service${r.added === 1 ? '' : 's'} from Ferdium${r.skipped.length ? `. Skipped: ${r.skipped.join(', ')}` : ''}. You only need to log in to each one again.`);
    } catch (e) {
      setFerdium(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e));
    }
  };

  return (
    <div className="ob">
      {step === 1 && (
        <div className="ob-c">
          <Brand size={72} />
          <h1>Welcome to Extrovert</h1>
          <p className="lead">All your communities. One space.</p>
          <div className="ob-logos">
            {PICKABLE.slice(0, 8).map((c) => <ServiceIcon key={c.id} type={c.id} size={36} />)}
            <span className="ob-more">+ any site</span>
          </div>
          {snap.googleConfigured ? (
            <button className="btn google big" disabled={snap.runtime.signingIn} onClick={signIn}>
              <span className="g">G</span> {snap.runtime.signingIn ? 'Waiting for your browser…' : 'Continue with Google'}
            </button>
          ) : (
            <p className="note warn">Google sign-in isn't configured: add <code>MAIN_VITE_GOOGLE_CLIENT_ID</code> and <code>MAIN_VITE_GOOGLE_CLIENT_SECRET</code> to the <code>.env</code> file, then restart.</p>
          )}
          {snap.runtime.signingIn && <><small className="muted">A tab opened in your browser. Pick your Google account there.</small><button className="linkish" onClick={() => act('cancelSignIn')}>Cancel</button></>}
          {error && <p className="err">{error}</p>}
          <div className="ob-props">
            <div><Icon name="globe" /><b>Every app, untouched</b><small>The real websites, exactly as you know them.</small></div>
            <div><Icon name="bell" /><b>Never miss a thing</b><small>Live badges on every app, every account.</small></div>
            <div><Icon name="shield" /><b>Private by design</b><small>No tracking. We never see your passwords.</small></div>
          </div>
          <small className="muted">Google only shares your name, email and photo, to create your workspace.</small>
        </div>
      )}

      {step === 2 && ws && (
        <div className="ob-c wide">
          <span className="step">Step 2 of 3</span>
          <h1>Pick your services</h1>
          <p className="lead">Signed in as {ws.email}. You can add more any time, including any website by its address.</p>
          <div className="ob-grid">
            {PICKABLE.map((c) => (
              <label key={c.id} className="ob-svc">
                <input type="checkbox" checked={picks.has(c.id)} onChange={() => {
                  const next = new Set(picks);
                  if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                  setPicks(next);
                }} />
                <ServiceIcon type={c.id} size={40} />
                <b>{c.name}</b>
                <i><Icon name="check" size={12} /></i>
              </label>
            ))}
          </div>
          <div className="custom-url"><Icon name="link" size={16} /><input placeholder="Add a website by its address (optional), e.g. web.telegram.org" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
          <button className="linkish" onClick={importFerdium}><Icon name="upload" size={14} /> Coming from Ferdium? Import your services</button>
          {ferdium && <p className="muted">{ferdium}</p>}
          <div className="ob-f">
            <button className="btn primary" disabled={!picks.size && !parseCustomUrl(url) && !ws.instances.length} onClick={finishPicks}>Continue</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="ob-c">
          <span className="step">Step 3 of 3</span>
          <h1>You're all set</h1>
          {isMac && (
            <div className="note" style={{ textAlign: 'left' }}>
              <Icon name="login" size={16} />
              <p>Already logged in to these sites in Arc, Chrome or another browser? <button className="linkish" onClick={() => setImporting(true)}>Sign in with your browser</button> to skip typing passwords.</p>
            </div>
          )}
          <p className="lead">A few shortcuts worth knowing:</p>
          <div className="ob-keys">
            {SHORTCUTS.filter((k) => FIRST_KEYS.includes(k.id)).map((k) => (
              <div key={k.id}><kbd>{formatKeys(k.keys, isMac)}</kbd><span>{k.label}</span></div>
            ))}
          </div>
          <div className="ob-f"><button className="btn primary" onClick={onDone}>Open my workspace</button></div>
          {importing && ws && <BrowserImport snap={snap} ws={ws} onClose={() => setImporting(false)} />}
        </div>
      )}
    </div>
  );
}
