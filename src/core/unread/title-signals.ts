/**
 * What a page title says besides its unread count. Facebook and Messenger "flash" the title while a
 * message is unread, alternating "(1) Messenger" with "Rahim sent you a message". Those flashes are
 * the only message signal Extrovert gets when the site notifies through its service worker.
 */

const SENDER = [
  /^(.{1,80}?) (?:sent you a message|messaged you|sent a message|sent you an? .{1,40}|replied to you|mentioned you.*)$/i,
  /^(?:new message from|message from) (.{1,80})$/i,
];
const CALL = /^(.{1,80}?) is (?:video )?calling(?: you)?\.?$|^incoming (?:video )?call(?: from (.{1,80}))?$/i;

export type TitleSignal = { kind: 'message'; sender: string; text: string } | { kind: 'call'; sender: string | null; text: string };

/** A message or call announced by the title, if any. Titles with a count, like "(2) Messenger", are not. */
export function titleSignal(title: string): TitleSignal | null {
  const t = title.trim().replace(/\s*[|·–-]\s*(?:Facebook|Messenger)$/i, '');
  if (!t || /^\(\d/.test(t)) return null;
  const call = CALL.exec(t);
  if (call) return { kind: 'call', sender: (call[1] ?? call[2] ?? null)?.trim() || null, text: t };
  for (const re of SENDER) {
    const m = re.exec(t);
    if (m?.[1]) return { kind: 'message', sender: m[1].trim(), text: t };
  }
  return null;
}

/**
 * The count to show when a new title arrives. A title without a count right after one with a count
 * is probably a flash: keep the count, and let the caller confirm the drop after a pause.
 */
export function nextUnread(previous: number, parsed: number): { unread: number; confirmLater: boolean } {
  if (parsed === 0 && previous > 0) return { unread: previous, confirmLater: true };
  return { unread: parsed, confirmLater: false };
}
