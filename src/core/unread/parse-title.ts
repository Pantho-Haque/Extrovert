/** Most services prefix the tab title with the unread count: "(3) Facebook", "(99+) Feed | LinkedIn". */
export const DEFAULT_UNREAD_PATTERN = /^\((\d[\d,]*)\+?\)/;

/** Unread count from a page title; 0 when the title carries no count. */
export function parseUnread(title: string, pattern: RegExp = DEFAULT_UNREAD_PATTERN): number {
  const raw = pattern.exec(title.trim())?.[1];
  return raw ? Number(raw.replaceAll(',', '')) : 0;
}
