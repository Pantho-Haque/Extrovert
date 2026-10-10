/** A website's own look in the sidebar: an icon from the app's icon pack, and a color. */
export interface Look {
  icon?: string | undefined;
  color?: string | undefined;
}

export const LOOK_COLORS = ['#4F46E5', '#0EA5E9', '#06B6D4', '#10B981', '#22C55E', '#84CC16', '#EAB308', '#F97316', '#EF4444', '#EC4899', '#A855F7', '#64748B'];
export const DEFAULT_LOOK_COLOR = '#64748B';

const ICON_KEY = /^[a-z0-9-]{1,40}$/;
const COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Only well-formed values are stored: icon keys like `brand-telegram`, colors like `#1A2B3C`.
 * An empty string clears the field (back to the site's own icon / the default color); anything else
 * is ignored. Only the fields present in `raw` are returned.
 */
export function cleanLook(raw: Record<string, unknown>): Look {
  const out: Look = {};
  for (const [key, valid] of [['icon', ICON_KEY], ['color', COLOR]] as const) {
    if (!(key in raw)) continue;
    const v = raw[key];
    if (v === '' || v === null) out[key] = undefined;
    else if (typeof v === 'string' && valid.test(v)) out[key] = key === 'color' ? v.toUpperCase() : v;
  }
  return out;
}
