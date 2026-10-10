/** Pick an icon (from the icon pack) and a color for a website you added. */
import { useState } from 'react';
import { IconWorld } from '@tabler/icons-react';
import { DEFAULT_LOOK_COLOR, LOOK_COLORS, type Look } from '../../core/services/look';
import { ICON_PACK } from './icon-pack';
import { Icon } from './icons';

/** The pack's brand icon whose name is in the address (web.telegram.org → Telegram), listed first. */
const brandFor = (url: string | undefined) => {
  const host = url ? URL.parse(url)?.hostname ?? '' : '';
  return ICON_PACK.find(([k]) => k.startsWith('brand-') && k.length > 9 && host.includes(k.slice(6).replace(/-/g, '')))?.[0];
};

export function LookPicker({ look, onChange, url, siteIcon }: { look: Look; onChange: (look: Look) => void; url?: string | undefined; siteIcon?: string | undefined }) {
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  const color = look.color ?? DEFAULT_LOOK_COLOR;
  const suggested = brandFor(url);
  const icons = ICON_PACK.filter(([key, name]) => !s || name.toLowerCase().includes(s) || key.includes(s)).sort(([a], [b]) => Number(b === suggested) - Number(a === suggested));

  return (
    <div className="look" style={{ ['--c' as string]: color }}>
      <div className="custom-url"><Icon name="search" size={15} /><input placeholder={`Search ${ICON_PACK.length} icons`} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="look-grid" role="listbox" aria-label="Icon">
        {!s && (
          <button role="option" aria-selected={!look.icon} className={`site ${!look.icon ? 'on' : ''}`} title="The website's own icon" onClick={() => onChange({ ...look, icon: undefined })}>
            {siteIcon ? <img src={siteIcon} alt="" width={20} height={20} /> : <IconWorld size={20} stroke={1.75} />}
          </button>
        )}
        {icons.map(([key, name, Glyph]) => (
          <button key={key} role="option" aria-selected={look.icon === key} className={look.icon === key ? 'on' : ''} title={name} onClick={() => onChange({ icon: key, color })}>
            <Glyph size={20} stroke={1.75} />
          </button>
        ))}
        {!icons.length && <p className="empty">No icon matches “{q}”.</p>}
      </div>
      <div className="look-colors" aria-label="Color">
        {LOOK_COLORS.map((c) => (
          <button key={c} className={`sw ${color === c ? 'on' : ''}`} style={{ background: c }} aria-label={`Color ${c}`} disabled={!look.icon} onClick={() => onChange({ ...look, color: c })} />
        ))}
        <label className={`sw any ${!LOOK_COLORS.includes(color) ? 'on' : ''}`} title="Any color">
          <input type="color" value={color} disabled={!look.icon} onChange={(e) => onChange({ ...look, color: e.target.value.toUpperCase() })} />
        </label>
        {!look.icon && <small className="muted">Pick an icon to color it</small>}
      </div>
    </div>
  );
}
