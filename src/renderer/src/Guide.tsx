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

/** Each slide's colors: [deep, glow, highlight]. Blended smoothly (see @property in styles.css). */
const MOODS: [string, string, string][] = [
  ['#3730A3', '#A855F7', '#EC4899'], // welcome
  ['#1E3A8A', '#6366F1', '#0EA5E9'], // workspaces
  ['#4C1D95', '#8B5CF6', '#22D3EE'], // your apps
  ['#831843', '#EC4899', '#F97316'], // never miss
  ['#312E81', '#6366F1', '#A855F7'], // flow
  ['#134E4A', '#0D9488', '#6366F1'], // privacy
  ['#14532D', '#10B981', '#EAB308'], // wellbeing
  ['#1E3A8A', '#3B82F6', '#14B8A6'], // performance
  ['#581C87', '#C026D3', '#6366F1'], // switching
  ['#3730A3', '#8B5CF6', '#EC4899'], // done
];
const mood = (i: number, last: number) => {
  const [deep, glow, hi] = MOODS[Math.round((i / last) * (MOODS.length - 1))] ?? MOODS[0]!;
  return { ['--deep' as string]: deep, ['--glow' as string]: glow, ['--hi' as string]: hi };
};
const SPARKS: [number, number, number][] = [[12, 18, 0], [84, 22, 1.2], [70, 78, 2.1], [22, 72, 0.6], [48, 12, 1.7], [92, 60, 2.6], [6, 50, 3.1], [58, 88, 0.9], [34, 40, 2.3], [76, 44, 3.6]];

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
        <div className="tour-stage" style={mood(i, last)}>
          {/* The backdrop stays while the slides change, so its colors blend from one mood to the next. */}
          <div className="tour-bg" aria-hidden="true">
            <i className="blob b1" /><i className="blob b2" /><i className="blob b3" /><i className="blob b4" />
            <span className="orbit" /><span className="orbit" /><span className="orbit" />
            {SPARKS.map(([x, y, d], k) => <b key={k} className="spark" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} />)}
          </div>
          <div key={i} className="tour-scene">
            <TourScene id={g?.id ?? (i === 0 ? 'intro' : 'outro')} icon={g && isIconName(g.icon) ? g.icon : 'star'} />
          </div>
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
