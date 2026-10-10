/** Small shared UI pieces. */
import { useEffect, type ReactNode } from 'react';
import { serviceDef } from '../../core/services/catalog';
import type { InstanceStatus, ServiceType, Workspace } from '../../shared/types';
import {
  IconBrandFacebook, IconBrandGmail, IconBrandGoogleDrive, IconBrandInstagram, IconBrandLinkedin, IconBrandMessenger, IconBrandWhatsapp,
  IconCalendarEvent, IconMessages, IconVideo, IconWorld, type Icon as TablerIcon,
} from '@tabler/icons-react';
import type { Look } from '../../core/services/look';
import { Icon } from './icons';
import { packIcon } from './icon-pack';

export function Brand({ size = 28 }: { size?: number }) {
  return (
    <span className="brand" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size * 0.7} height={size * 0.7} aria-hidden="true">
        <circle cx="9" cy="12" r="5.4" fill="none" stroke="#fff" strokeWidth="2.2" />
        <circle cx="15" cy="12" r="5.4" fill="none" stroke="#fff" strokeWidth="2.2" />
      </svg>
    </span>
  );
}

/** Outline brand icons (Tabler, MIT). Calendar, Meet and Chat have no brand outline anywhere, so they use matching outline icons in their Google color. */
const BRAND_ICONS: Record<Exclude<ServiceType, 'custom'>, TablerIcon> = {
  facebook: IconBrandFacebook, messenger: IconBrandMessenger, whatsapp: IconBrandWhatsapp, instagram: IconBrandInstagram,
  linkedin: IconBrandLinkedin, gmail: IconBrandGmail, drive: IconBrandGoogleDrive, calendar: IconCalendarEvent, meet: IconVideo, chat: IconMessages,
};

/**
 * A service's icon: an outline brand icon on a tile tinted with the brand color. Instant and offline.
 * Custom websites use their own site icon once loaded, otherwise a globe.
 */
export function ServiceIcon({ type, status, size = 34, look }: { type: ServiceType; status?: InstanceStatus | undefined; size?: number; name?: string; look?: Look | undefined }) {
  // A website you added can have an icon from the pack and a color of your choice (Settings → Services).
  const picked = type === 'custom' ? packIcon(look?.icon) : undefined;
  if (type === 'custom' && !picked && status?.icon) return <img className="site-icon" src={status.icon} width={size} height={size} alt="" draggable={false} />;
  const Glyph = picked ?? (type === 'custom' ? IconWorld : BRAND_ICONS[type]);
  const color = type === 'custom' ? (look?.color ?? serviceDef(type).color) : serviceDef(type).color;
  return (
    <span className="svc-tile" style={{ width: size, height: size, ['--brand' as string]: color }}>
      <Glyph size={Math.round(size * 0.6)} stroke={1.75} aria-hidden="true" />
    </span>
  );
}

/** A Google account: its photo, or its initial on the workspace color. */
export function Avatar({ ws, size = 34 }: { ws: Pick<Workspace, 'name' | 'color' | 'picture'>; size?: number }) {
  return (
    <span className="av" style={{ width: size, height: size, fontSize: size * 0.42, ['--c' as string]: ws.color }}>
      {ws.picture ? <img src={ws.picture} alt="" draggable={false} /> : ws.name[0]?.toUpperCase()}
    </span>
  );
}

const PERSON_COLORS = ['#F97316', '#0EA5E9', '#8B5CF6', '#10B981', '#EF4444', '#EAB308', '#EC4899', '#14B8A6', '#6366F1'];
export function PersonAvatar({ name, size = 34 }: { name: string; size?: number }) {
  const color = PERSON_COLORS[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % PERSON_COLORS.length];
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return <span className="av" style={{ width: size, height: size, fontSize: size * 0.38, ['--c' as string]: color }}>{initials}</span>;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </label>
  );
}

export function Row({ title, desc, children }: { title: ReactNode; desc?: ReactNode; children?: ReactNode }) {
  return (
    <div className="srow">
      <div>
        <b>{title}</b>
        {desc && <small>{desc}</small>}
      </div>
      <div className="sctrl">{children}</div>
    </div>
  );
}

/** Centered dialog. Escape or a click on the backdrop closes it. */
export function Modal({ title, wide, className = '', onClose, children }: { title: string; wide?: boolean; className?: string; onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''} ${className}`} role="dialog" aria-label={title}>
        <div className="modal-h">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="modal-b">{children}</div>
      </div>
    </div>
  );
}

export function StateCard({ icon, title, text, tone, children }: { icon: Parameters<typeof Icon>[0]['name']; title: string; text: ReactNode; tone?: 'warn'; children?: ReactNode }) {
  return (
    <div className="state">
      <div className={`state-card ${tone ?? ''}`}>
        <span className="state-ic"><Icon name={icon} size={28} /></span>
        <h2>{title}</h2>
        <p>{text}</p>
        <div className="row">{children}</div>
      </div>
    </div>
  );
}

export function useEscape(fn: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && fn();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fn]);
}
