/**
 * Simulated pictures for the feature tour, one per feature group (by id in the registry).
 * Drawn with the app's own pieces; nothing here touches the real app. A new group without a scene
 * shows its icon instead.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { ServiceType } from '../../shared/types';
import { Icon, type IconName } from './icons';
import { isMac } from './lib';
import { Brand, ServiceIcon } from './ui';

const delay = (k: number): CSSProperties => ({ animationDelay: `${120 + k * 90}ms` });
const Badge = ({ n }: { n: number }) => <span className="sc-badge">{n}</span>;
const Lines = ({ w = [70, 45] }: { w?: number[] }) => <span className="sc-lines">{w.map((x, k) => <i key={k} style={{ width: `${x}%` }} />)}</span>;
const Key = ({ children }: { children: ReactNode }) => <kbd className="sc-key">{children}</kbd>;
const mod = isMac ? '⌘' : 'Ctrl';

const RING: ServiceType[] = ['facebook', 'messenger', 'whatsapp', 'instagram', 'linkedin', 'gmail', 'calendar', 'drive'];

const SCENES: Record<string, () => ReactNode> = {
  intro: () => (
    <div className="sc-ring">
      <span className="sc-pop sc-brand"><Brand size={96} /></span>
      {RING.map((t, k) => (
        <span key={t} className="sc-orbit sc-pop" style={{ ...delay(k), ['--a' as string]: `${(360 / RING.length) * k}deg` }}><ServiceIcon type={t} size={44} /></span>
      ))}
    </div>
  ),

  workspaces: () => (
    <div className="sc-row">
      <div className="sc-card sc-pop" style={{ width: 300 }}>
        {[['P', 'Personal', '#4F46E5', 3], ['W', 'Work', '#0EA5E9', 12], ['S', 'Side project', '#EC4899', 0]].map(([i, name, c, n], k) => (
          <div key={name as string} className={`sc-acct sc-pop ${k === 0 ? 'on' : ''}`} style={delay(k + 1)}>
            <span className="sc-av" style={{ background: c as string }}>{i}</span>
            <b>{name}</b>
            {(n as number) > 0 && <Badge n={n as number} />}
          </div>
        ))}
      </div>
      <div className="sc-col sc-group sc-pop" style={delay(4)}>
        <span className="sc-tile"><ServiceIcon type="whatsapp" size={46} /><span className="sc-tag">1</span></span>
        <span className="sc-tile"><ServiceIcon type="whatsapp" size={46} /><span className="sc-tag b">B</span><Badge n={4} /></span>
      </div>
    </div>
  ),

  services: () => (
    <div className="sc-col" style={{ gap: 18 }}>
      <div className="sc-grid">
        {(['facebook', 'messenger', 'whatsapp', 'instagram', 'linkedin', 'gmail', 'calendar', 'drive', 'meet', 'chat'] as ServiceType[]).map((t, k) => (
          <span key={t} className="sc-pop" style={delay(k)}><ServiceIcon type={t} size={52} /></span>
        ))}
      </div>
      <div className="sc-pill sc-pop" style={delay(11)}><Icon name="plus" size={16} /> web.telegram.org</div>
    </div>
  ),

  attention: () => (
    <div className="sc-row">
      <div className="sc-col sc-rail">
        {([['whatsapp', 4], ['instagram', 1], ['gmail', 12], ['linkedin', 0]] as [ServiceType, number][]).map(([t, n], k) => (
          <span key={t} className="sc-tile sc-pop" style={delay(k)}><ServiceIcon type={t} size={44} />{n > 0 && <Badge n={n} />}</span>
        ))}
      </div>
      <div className="sc-col" style={{ gap: 12, alignItems: 'stretch' }}>
        {([['whatsapp', 'Rahim', 'Are we still on for tonight?'], ['linkedin', 'Sara', 'Thanks for the intro!']] as [ServiceType, string, string][]).map(([t, who, text], k) => (
          <div key={who} className="sc-card sc-toast sc-slide" style={delay(k + 3)}><ServiceIcon type={t} size={32} /><div><b>{who}</b><small>{text}</small></div></div>
        ))}
        <div className="sc-pill sc-pop" style={delay(6)}><Key>{mod}J</Key> Next unread</div>
      </div>
    </div>
  ),

  flow: () => (
    <div className="sc-card sc-palette sc-pop">
      <div className="sc-search"><Icon name="search" size={16} /><span>insta<i className="sc-caret" /></span><Key>{mod}K</Key></div>
      {([['instagram', 'Instagram', 'Personal'], ['instagram', 'Instagram', 'Work'], ['messenger', 'Messenger', 'Personal']] as [ServiceType, string, string][]).map(([t, name, ws], k) => (
        <div key={name + ws} className={`sc-res sc-slide ${k === 0 ? 'on' : ''}`} style={delay(k + 1)}><ServiceIcon type={t} size={26} /><b>{name}</b><small>{ws}</small></div>
      ))}
    </div>
  ),

  privacy: () => (
    <div className="sc-row">
      <div className="sc-card sc-lock sc-pop">
        <div className="sc-blur"><Lines w={[80, 60]} /><Lines w={[50, 70]} /><Lines w={[65, 40]} /></div>
        <div className="sc-lock-c"><span className="sc-lock-i"><Icon name="lock" size={26} /></span><span className="sc-pin">{[0, 1, 2, 3].map((k) => <i key={k} className="sc-pop" style={delay(k + 2)} />)}</span></div>
      </div>
      <div className="sc-col" style={{ gap: 12 }}>
        <span className="sc-tile sc-pop" style={delay(3)}><ServiceIcon type="meet" size={46} /><span className="sc-live"><Icon name="camera" size={10} /></span></span>
        <div className="sc-pill sc-pop" style={delay(5)}><Icon name="shield" size={15} /> Previews hidden</div>
        <div className="sc-pill sc-pop" style={delay(6)}><Key>{isMac ? '⌘⇧L' : 'Ctrl+Shift+L'}</Key></div>
      </div>
    </div>
  ),

  wellbeing: () => (
    <div className="sc-col" style={{ gap: 14 }}>
      <div className="sc-card sc-bars sc-pop">
        {([['instagram', 72, '48m'], ['facebook', 45, '31m'], ['whatsapp', 30, '20m'], ['linkedin', 16, '11m']] as [ServiceType, number, string][]).map(([t, w, m], k) => (
          <div key={t} className="sc-bar"><ServiceIcon type={t} size={26} /><span><i className="sc-grow" style={{ width: `${w}%`, ...delay(k + 1) }} /></span><small>{m}</small></div>
        ))}
      </div>
      <div className="sc-pill sc-pop" style={delay(6)}><Icon name="coffee" size={15} /> Still want to scroll?</div>
    </div>
  ),

  performance: () => (
    <div className="sc-card sc-bars sc-pop">
      {([['whatsapp', 34, '210 MB', 'live'], ['gmail', 52, '320 MB', 'live'], ['facebook', 0, 'Sleeping', 'sleep'], ['instagram', 0, 'Sleeping', 'sleep']] as [ServiceType, number, string, string][]).map(([t, w, m, st], k) => (
        <div key={t} className={`sc-bar ${st}`}><ServiceIcon type={t} size={26} /><span>{st === 'live' ? <i className="sc-grow" style={{ width: `${w}%`, ...delay(k + 1) }} /> : <em><Icon name="moon" size={12} /></em>}</span><small>{m}</small></div>
      ))}
    </div>
  ),

  switching: () => (
    <div className="sc-row" style={{ gap: 14 }}>
      {([['upload', 'Ferdium import'], ['download', 'Update ready'], ['alert', 'Report a problem']] as [IconName, string][]).map(([i, t], k) => (
        <div key={t} className="sc-card sc-mini sc-pop" style={delay(k)}><span className="sc-mini-i"><Icon name={i} size={22} /></span><b>{t}</b></div>
      ))}
    </div>
  ),

  outro: () => (
    <div className="sc-col" style={{ gap: 16 }}>
      <div className="sc-keycaps sc-pop"><Key>{mod}</Key><Key>/</Key></div>
      <div className="sc-pill sc-pop" style={delay(2)}><Icon name="command" size={15} /> Shortcuts & features</div>
    </div>
  ),
};

export function TourScene({ id, icon }: { id: string; icon: IconName }) {
  const scene = SCENES[id];
  return <div className="sc">{scene ? scene() : <span className="sc-fallback sc-pop"><Icon name={icon} size={48} /></span>}</div>;
}
