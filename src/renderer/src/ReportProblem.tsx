/**
 * Report a problem: fills in a GitHub issue (no server). The user reviews everything here, then
 * submits it on GitHub with their own account.
 */
import { useEffect, useState } from 'react';
import { MAX_DETAILS, MAX_TITLE, reportText, SEVERITIES, type Severity } from '../../core/feedback/issue';
import { serviceDef } from '../../core/services/catalog';
import type { AppSnapshot } from '../../shared/ipc';
import { Icon } from './icons';
import { act, api, isMac } from './lib';
import { Modal } from './ui';

const ITSELF = 'Extrovert itself';

export function ReportProblem({ snap, onClose }: { snap: AppSnapshot; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [severity, setSeverity] = useState<Severity>('annoying');
  const [where, setWhere] = useState(ITSELF);
  const [system, setSystem] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => void act('systemInfo').then(setSystem), []);

  const services = [...new Set(snap.workspaces.flatMap((w) => w.instances.map((i) => serviceDef(i.type).name)))];
  const report = { title, details, severity, where };
  const ready = !!title.trim() && !!details.trim();

  return (
    <Modal title="Report a problem" className="report-modal" onClose={onClose}>
      <label className="field-l">What went wrong?
        <input className="field" autoFocus maxLength={MAX_TITLE} placeholder="For example: WhatsApp's badge stays at 0" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <div className="report-row">
        <label className="field-l">Where?
          <select className="field" value={where} onChange={(e) => setWhere(e.target.value)}>
            {[ITSELF, ...services].map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <div className="field-l">How bad is it?
          <div className="seg">{SEVERITIES.map((s) => <button key={s.id} className={severity === s.id ? 'on' : ''} title={s.text} onClick={() => setSeverity(s.id)}>{s.label}</button>)}</div>
          <small className="muted">{SEVERITIES.find((s) => s.id === severity)!.text}</small>
        </div>
      </div>

      <label className="field-l">Details
        <textarea className="field" rows={5} maxLength={MAX_DETAILS} placeholder="What were you doing? What did you expect, and what happened instead?" value={details} onChange={(e) => setDetails(e.target.value)} />
      </label>

      <p className="hint"><Icon name="screen" size={14} /> A screenshot helps: take one ({isMac ? '⌘⇧4' : api.platform === 'win32' ? 'Win+Shift+S' : 'PrtSc'}) and paste it on the GitHub page.</p>

      <details className="report-sys">
        <summary>Also attached: app version and system details (no personal data)</summary>
        <pre>{system || 'Loading…'}</pre>
      </details>

      <div className="note warn">
        <Icon name="alert" size={16} />
        <p>
          <b>You need a free GitHub account to send this.</b> Your report opens on GitHub, filled in; sign in there and submit it.{' '}
          <button className="linkish" onClick={() => act('openExternal', { url: 'https://github.com/signup' })}>Create an account</button>
          <br />Reports are public, so leave out private messages, emails and names.
        </p>
      </div>

      <div className="modal-f">
        <button className="btn" disabled={!ready} onClick={() => { void act('copyText', { text: reportText(report, system) }); setCopied(true); }}>{copied ? 'Copied' : 'Copy report'}</button>
        <button className="btn primary" disabled={!ready} onClick={() => { void act('reportProblem', report); onClose(); }}>Continue on GitHub</button>
      </div>
    </Modal>
  );
}
