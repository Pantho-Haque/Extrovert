/** "Sign in with your browser": reuse logins from Arc, Chrome, Brave, Edge… for this workspace's services. */
import { useEffect, useState } from 'react';
import { instanceName } from '../../core/workspaces/model';
import type { AppSnapshot, BrowserInfo, ImportResult } from '../../shared/ipc';
import type { Workspace } from '../../shared/types';
import { act } from './lib';
import { Modal, ServiceIcon } from './ui';

const QR_ONLY = 'whatsapp';

export function BrowserImport({ snap, ws, onClose }: { snap: AppSnapshot; ws: Workspace; onClose: () => void }) {
  const [browsers, setBrowsers] = useState<BrowserInfo[] | null>(null);
  const [browserId, setBrowserId] = useState('');
  const [profileDir, setProfileDir] = useState('');
  const [selected, setSelected] = useState(() => new Set(ws.instances.filter((i) => i.type !== QR_ONLY).map((i) => i.id)));
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [error, setError] = useState('');
  const browser = browsers?.find((b) => b.id === browserId);

  const choose = (b: BrowserInfo) => {
    setBrowserId(b.id);
    setProfileDir(b.profiles[0]?.dir ?? '');
    setResults(null);
  };

  useEffect(() => {
    void act('listBrowsers').then((list) => {
      setBrowsers(list);
      const first = list.find((b) => b.isDefault) ?? list[0];
      if (first) choose(first);
    });
  }, []);

  const run = async () => {
    setBusy(true);
    setError('');
    setResults(null);
    try {
      setResults(await act('importSignIns', { workspaceId: ws.id, browserId, profileDir, instanceIds: [...selected] }));
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Sign in with your browser" onClose={onClose}>
      <p className="muted">Already logged in to these sites in another browser? Extrovert can copy those logins into <b>{ws.name}</b>, so you don't have to type passwords again. Only the services you pick are copied, and nothing leaves your computer.</p>
      {!browsers && <div className="spinner" />}
      {browsers?.length === 0 && <div className="note warn"><p>No supported browser found. This works with Arc, Chrome, Brave, Edge, Vivaldi, Opera and Chromium on macOS. You can always log in directly inside each service.</p></div>}
      {browser && (
        <>
          <h5>1 · The browser you're logged in with</h5>
          <div className="browsers" role="radiogroup">
            {browsers!.map((b) => (
              <button key={b.id} role="radio" aria-checked={b.id === browserId} className={`choice ${b.id === browserId ? 'on' : ''}`} onClick={() => choose(b)}>
                {b.name}{b.isDefault && <small>Default browser</small>}
              </button>
            ))}
          </div>
          {browser.profiles.length > 1 && (
            <p className="sctrl" style={{ marginTop: 12 }}>Profile
              <select value={profileDir} onChange={(e) => setProfileDir(e.target.value)}>{browser.profiles.map((p) => <option key={p.dir} value={p.dir}>{p.name}</option>)}</select>
            </p>
          )}
          <h5>2 · What to sign in to</h5>
          {ws.instances.length === 0 && <p className="empty">Add services to this workspace first.</p>}
          <div className="picks">
            {ws.instances.map((inst) => {
              const qr = inst.type === QR_ONLY;
              const r = results?.find((x) => x.instanceId === inst.id);
              return (
                <label key={inst.id} className={`pick ${qr ? 'disabled' : ''}`}>
                  <input type="checkbox" disabled={qr || busy} checked={!qr && selected.has(inst.id)} onChange={() => {
                    const next = new Set(selected);
                    if (next.has(inst.id)) next.delete(inst.id); else next.add(inst.id);
                    setSelected(next);
                  }} />
                  <ServiceIcon type={inst.type} look={inst} name={instanceName(inst)} status={snap.statuses[inst.id]} size={22} />
                  <span>{instanceName(inst)}</span>
                  {qr && <small>Needs a one-time QR scan with your phone</small>}
                  {r && (r.error ? <small className="bad">{r.error}</small> : <small className="good">✓ Signed in</small>)}
                </label>
              );
            })}
          </div>
          <div className="note"><p>When you click Import, macOS asks to allow access to “{browser.name} Safe Storage”. Click <b>Always Allow</b>: it's the key {browser.name} uses to protect its saved logins. Extrovert never saves it. When a copied login expires, Extrovert copies it again from {browser.name} by itself; "Always Allow" lets that happen without asking.</p></div>
          {error && <p className="err">{error}</p>}
          <div className="modal-f">
            <button className="btn" onClick={onClose}>{results ? 'Done' : 'Cancel'}</button>
            <button className="btn primary" disabled={busy || !selected.size} onClick={run}>{busy ? 'Importing…' : 'Import sign-ins'}</button>
          </div>
        </>
      )}
    </Modal>
  );
}
