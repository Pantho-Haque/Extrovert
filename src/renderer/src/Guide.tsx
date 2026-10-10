/**
 * "Shortcuts & features" panel and the feature tour. Both are drawn from the registry
 * (src/core/guide/registry.ts), so they change whenever a feature or shortcut changes.
 */
import { useEffect, useState } from 'react';
import { FEATURE_GROUPS, formatKeys, keyOf, SHORTCUTS, type Feature, type FeatureGroup } from '../../core/guide/registry';
import { Icon, isIconName } from './icons';
import { act, isMac } from './lib';
import { TourScene } from './TourScenes';
import { Modal, useEscape } from './ui';

const forThisOs = (f: Feature) => !f.macOnly || isMac;
const GroupIcon = ({ g, size = 18 }: { g: FeatureGroup; size?: number }) => <Icon name={isIconName(g.icon) ? g.icon : 'star'} size={size} />;

export function Guide({ onClose, onTour, onReport }: { onClose: () => void; onTour: () => void; onReport: () => void }) {
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  const hit = (...text: (string | undefined)[]) => !s || text.some((t) => t?.toLowerCase().includes(s));
  const shortcuts = SHORTCUTS.filter((k) => hit(k.label, formatKeys(k.keys, isMac)));
  const groups = FEATURE_GROUPS.map((g) => ({ ...g, features: g.features.filter((f) => forThisOs(f) && hit(f.title, f.text, f.where, g.title)) })).filter((g) => g.features.length);

  return (
    <Modal title="Shortcuts & features" wide className="guide-modal" onClose={onClose}>
      <div className="guide-top">
        <div className="custom-url"><Icon name="search" size={16} /><input autoFocus placeholder="Search shortcuts and features" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <button className="btn" onClick={onTour}><Icon name="compass" size={15} /> Take the tour</button>
        <button className="btn" onClick={onReport}><Icon name="alert" size={15} /> Report a problem</button>
      </div>
      <div className="guide">
        <section>
          <h5>Keyboard shortcuts</h5>
          {(['Navigate', 'Services', 'Privacy', 'Window'] as const).map((group) => {
            const list = shortcuts.filter((k) => k.group === group);
            return list.length > 0 && (
              <div key={group} className="keys guide-keys">
                <small>{group}</small>
                {list.map((k) => <div key={k.id}><kbd>{formatKeys(k.keys, isMac)}</kbd><span>{k.label}</span></div>)}
              </div>
            );
          })}
          {!shortcuts.length && <p className="empty">No shortcut matches.</p>}
        </section>
        <section>
          <h5>Features</h5>
          {groups.map((g) => (
            <div key={g.id} className="guide-group">
              <b className="guide-gt"><GroupIcon g={g} size={15} /> {g.title}</b>
              {g.features.map((f) => (
                <div key={f.title} className="guide-f">
                  <b>{f.title}{f.shortcut && <kbd>{keyOf(f.shortcut, isMac)}</kbd>}</b>
                  <span>{f.text}</span>
                  {f.where && <small><Icon name="compass" size={11} /> {f.where}</small>}
                </div>
              ))}
            </div>
          ))}
          {!groups.length && <p className="empty">No feature matches “{q}”.</p>}
        </section>
      </div>
    </Modal>
  );
}

/** A short, simulated walk through every feature: one slide per feature group. Nothing in the app is touched. */
export function Tour({ onClose }: { onClose: () => void }) {
  const groups = FEATURE_GROUPS.map((g) => ({ ...g, features: g.features.filter(forThisOs) }));
  const last = groups.length + 1;
  const [i, setI] = useState(0);
  const done = () => {
    void act('updateSettings', { patch: { tourDone: true } });
    onClose();
  };
  useEscape(done);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((n) => Math.min(last, n + 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last]);
  const g = i > 0 && i < last ? groups[i - 1] : undefined;
  const count = groups.reduce((n, x) => n + x.features.length, 0);
  const [title, line] = g ? [g.title, g.tagline] : i === 0 ? ['Welcome to Extrovert', `All your communities, one space. ${count} features in ${groups.length} quick steps.`] : ["You're all set", 'Every feature and shortcut, any time.'];

  return (
    <div className="backdrop">
      <div className="tour" role="dialog" aria-label="Feature tour">
        <div key={i} className="tour-stage">
          <TourScene id={g?.id ?? (i === 0 ? 'intro' : 'outro')} icon={g && isIconName(g.icon) ? g.icon : 'star'} />
        </div>
        <div key={`t${i}`} className="tour-text">
          <span className="step">{g ? `${i} / ${groups.length}` : i === 0 ? 'Tour' : 'Done'}</span>
          <h2>{title}</h2>
          <p className="lead">{line}</p>
          {g && <div className="tour-chips">{g.features.map((f, k) => <span key={f.title} title={f.text} style={{ animationDelay: `${200 + k * 40}ms` }}>{f.short}{f.shortcut && <kbd>{keyOf(f.shortcut, isMac)}</kbd>}</span>)}</div>}
        </div>
        <div className="tour-f">
          <div className="tour-dots">{Array.from({ length: last + 1 }, (_, k) => <button key={k} className={k === i ? 'on' : ''} aria-label={`Step ${k + 1}`} onClick={() => setI(k)} />)}</div>
          {i < last && <button className="linkish" onClick={done}>Skip</button>}
          {i > 0 && <button className="btn" onClick={() => setI(i - 1)}><Icon name="left" size={15} /> Back</button>}
          {i < last ? <button className="btn primary" autoFocus onClick={() => setI(i + 1)}>{i === 0 ? 'Start' : 'Next'} <Icon name="right" size={15} /></button>
            : <button className="btn primary" onClick={done}>Get started</button>}
        </div>
      </div>
    </div>
  );
}
