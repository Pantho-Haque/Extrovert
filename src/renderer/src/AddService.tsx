/** Add services (FR-S01…S03): pick any number from the catalog, plus any website by its address, then add them together. */
import { useEffect, useState } from 'react';
import { catalog, parseCustomUrl } from '../../core/services/catalog';
import type { Look } from '../../core/services/look';
import type { AppSnapshot } from '../../shared/ipc';
import type { ServiceType, Workspace } from '../../shared/types';
import { Icon } from './icons';
import { act } from './lib';
import type { Overlay } from './Shell';
import { LookPicker } from './LookPicker';
import { Modal, ServiceIcon } from './ui';

export function AddService({ snap, ws, onClose, onOpen }: { snap: AppSnapshot; ws: Workspace; onClose: () => void; onOpen: (o: Overlay) => void }) {
  const [picked, setPicked] = useState<ServiceType[]>([]);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [look, setLook] = useState<Look>({});
  const [styling, setStyling] = useState(false);
  const [siteIcon, setSiteIcon] = useState<string | undefined>();
  const custom = parseCustomUrl(url);
  const count = picked.length + (custom ? 1 : 0);
  // Show the website's own icon as soon as the address is complete (it is also saved when added).
  useEffect(() => {
    setSiteIcon(undefined);
    if (!custom) return;
    let live = true;
    const t = setTimeout(() => void act('siteIcon', { url: custom.url }).then((icon) => live && setSiteIcon(icon ?? undefined)), 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [custom?.url]);
  const has = (type: ServiceType) => ws.instances.some((i) => i.type === type);
  const signedInGoogle = ws.instances.some((i) => i.session === 'google' && snap.statuses[i.id]?.signedIn);

  const toggle = (type: ServiceType) => setPicked((p) => (p.includes(type) ? p.filter((t) => t !== type) : [...p, type]));

  const add = async () => {
    setBusy(true);
    const items: { type: ServiceType; url?: string; label?: string; icon?: string; color?: string }[] = picked.map((type) => ({ type }));
    if (custom) items.push({ type: 'custom', url: custom.url, label: custom.name, ...(look.icon ? { icon: look.icon, color: look.color } : {}) });
    await act('addInstances', { workspaceId: ws.id, items });
    onClose();
  };

  const card = (type: ServiceType) => {
    const on = picked.includes(type);
    return (
      <button key={type} className={`cat ${on ? 'on' : ''}`} onClick={() => toggle(type)} aria-pressed={on}>
        <span className="cat-check" aria-hidden="true">{on && <Icon name="check" size={12} />}</span>
        <ServiceIcon type={type} size={40} />
        <b>{catalog.find((c) => c.id === type)!.name}</b>
        {has(type) && <small>+ another account</small>}
      </button>
    );
  };

  return (
    <Modal title="Add services" wide onClose={onClose}>
      <p className="muted">Adding to <b style={{ color: ws.color }}>{ws.name}</b>. Pick as many as you like.</p>
      <h5>Social</h5>
      <div className="cat-grid">{catalog.filter((c) => c.group === 'social').map((c) => card(c.id))}</div>
      <h5>Google</h5>
      <div className="cat-grid">{catalog.filter((c) => c.group === 'google').map((c) => card(c.id))}</div>
      <p className="hint"><Icon name="check" size={14} /> {signedInGoogle ? `Already signed in to Google here: new Google apps open signed in as ${ws.email}.` : 'All Google apps share one sign-in: sign in once, and Gmail, Calendar, Drive, Meet and Chat are all signed in.'}</p>
      <h5>Any website</h5>
      <div className="custom-url">
        <Icon name="link" size={16} />
        <input placeholder="Paste an address, e.g. web.telegram.org" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && count && !busy && void add()} />
      </div>
      {custom && (
        <>
          <div className="cu-prev">
            <ServiceIcon type="custom" look={{ ...look, siteIcon }} size={36} />
            <div><b>{custom.name}</b><small>{custom.url}</small></div>
            <button className="btn sm" aria-expanded={styling} onClick={() => setStyling(!styling)}><Icon name="star" size={14} /> Icon & color</button>
          </div>
          {styling && <LookPicker look={look} url={custom.url} siteIcon={siteIcon} onChange={setLook} />}
        </>
      )}
      {snap.platform === 'darwin' && (
        <div className="note"><Icon name="login" size={16} /><p>Already logged in to these sites in Arc, Chrome or another browser? <button className="linkish" onClick={() => onOpen({ kind: 'browserImport' })}>Sign in with your browser</button> after adding them.</p></div>
      )}
      <div className="modal-f">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!count || busy} onClick={add}>{busy ? 'Adding…' : count ? `Add ${count} service${count === 1 ? '' : 's'}` : 'Pick services to add'}</button>
      </div>
    </Modal>
  );
}
