/* Extrovert prototype: static demo data + icon helpers. Visual only, no real accounts. */

const ICONS = {
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>',
  video: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  chart: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  pin: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  eyeoff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  expand: '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  up: '<polyline points="18 15 12 9 6 15"/>',
  down: '<polyline points="6 9 12 15 18 9"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  power: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
  coffee: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
  wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
};

function icon(name, size = 18) {
  return `<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

/* Service catalog. Glyphs are simplified marks, not official logos. */
const CATALOG = {
  facebook:  { name: 'Facebook',  url: 'facebook.com',            kind: 'feed', bg: '#1877F2',
    glyph: '<text x="12" y="18.5" text-anchor="middle" font-size="18" font-weight="800" font-family="Arial,sans-serif" fill="#fff">f</text>' },
  messenger: { name: 'Messenger', url: 'facebook.com/messages',   kind: 'chat', bg: 'linear-gradient(135deg,#00B2FF,#A033FF)',
    glyph: '<path d="M12 3C7 3 3 6.6 3 11.2c0 2.6 1.3 4.9 3.3 6.4V21l3-1.7c.9.3 1.8.4 2.7.4 5 0 9-3.6 9-8.2S17 3 12 3z" fill="#fff"/><path d="M7 13.6l3-3.3 2.1 2.1 3-3.3-3 5.6-2.1-2.1z" fill="#7C4DFF"/>' },
  whatsapp:  { name: 'WhatsApp',  url: 'web.whatsapp.com',        kind: 'chat', bg: '#25D366',
    glyph: '<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M9 8.5c.3-.5.7-.5 1-.1l.8 1.3c.2.3 0 .7-.3 1 .5 1 1.3 1.8 2.3 2.3.3-.3.7-.5 1-.3l1.3.8c.4.3.4.7-.1 1-.9.7-2 .6-3.4-.2a8 8 0 0 1-2.8-2.8C8.4 10.5 8.3 9.4 9 8.5z" fill="#fff"/>' },
  instagram: { name: 'Instagram', url: 'instagram.com',           kind: 'feed', bg: 'linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)',
    glyph: '<rect x="4" y="4" width="16" height="16" rx="5" fill="none" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="3.6" fill="none" stroke="#fff" stroke-width="2"/><circle cx="16.8" cy="7.2" r="1.1" fill="#fff"/>' },
  linkedin:  { name: 'LinkedIn',  url: 'linkedin.com/feed',       kind: 'feed', bg: '#0A66C2',
    glyph: '<text x="12" y="17" text-anchor="middle" font-size="12.5" font-weight="800" font-family="Arial,sans-serif" fill="#fff">in</text>' },
  gmail:     { name: 'Gmail',     url: 'mail.google.com',         kind: 'mail', bg: '#fff',
    glyph: '<path d="M3.5 7.5l8.5 6 8.5-6" fill="none" stroke="#EA4335" stroke-width="2.4" stroke-linejoin="round"/><path d="M3.5 7.5v10h3V10.5M20.5 7.5v10h-3V10.5" fill="none" stroke="#4285F4" stroke-width="2.4"/>' },
  calendar:  { name: 'Calendar',  url: 'calendar.google.com',     kind: 'tool', bg: '#fff',
    glyph: '<rect x="4" y="5" width="16" height="15" rx="2.5" fill="none" stroke="#4285F4" stroke-width="2"/><text x="12" y="17.3" text-anchor="middle" font-size="8" font-weight="700" font-family="Arial,sans-serif" fill="#4285F4">31</text>' },
  drive:     { name: 'Drive',     url: 'drive.google.com',        kind: 'tool', bg: '#fff',
    glyph: '<path d="M8.6 4h6.8l5.6 9.6h-6.8z" fill="#FBBC04"/><path d="M8.6 4L3 13.6l3.4 5.9L12 9.9z" fill="#34A853"/><path d="M6.4 19.5h11.2l3.4-5.9H9.8z" fill="#4285F4"/>' },
  meet:      { name: 'Meet',      url: 'meet.google.com',         kind: 'call', bg: '#fff',
    glyph: '<rect x="3" y="7" width="12" height="10" rx="2" fill="#00897B"/><path d="M15 10.5l5-3v9l-5-3z" fill="#FBBC04"/>' },
  chat:      { name: 'Chat',      url: 'chat.google.com',         kind: 'chat', bg: '#fff',
    glyph: '<path d="M4 5h16v11H9l-5 4z" fill="#34A853"/><circle cx="9" cy="10.5" r="1.2" fill="#fff"/><circle cx="12" cy="10.5" r="1.2" fill="#fff"/><circle cx="15" cy="10.5" r="1.2" fill="#fff"/>' },
  custom:    { name: 'Custom',    url: '',                        kind: 'custom', bg: '#64748B',
    glyph: '<circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M4 12h16M12 4c2.2 2.3 3.2 5 3.2 8s-1 5.7-3.2 8c-2.2-2.3-3.2-5-3.2-8s1-5.7 3.2-8z" fill="none" stroke="#fff" stroke-width="1.6"/>' },
};

function logo(type, size = 36) {
  const c = CATALOG[type];
  const light = c.bg === '#fff' ? ' logo-light' : '';
  return `<span class="logo${light}" style="width:${size}px;height:${size}px;background:${c.bg}"><svg viewBox="0 0 24 24" width="${size * 0.62}" height="${size * 0.62}">${c.glyph}</svg></span>`;
}

const AV_COLORS = ['#F97316', '#0EA5E9', '#8B5CF6', '#10B981', '#EF4444', '#EAB308', '#EC4899', '#14B8A6', '#6366F1'];
function av(name, size = 32) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const color = AV_COLORS[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AV_COLORS.length];
  return `<span class="av" style="width:${size}px;height:${size}px;background:${color};font-size:${Math.round(size * 0.4)}px">${initials}</span>`;
}

/* Mutable prototype state. */
const STATE = {
  theme: 'light',
  activeWs: 'personal',
  dnd: false,
  digest: false,
  digestQueue: [],
  zen: false,
  sharing: false,
  call: null,
  afterHours: false,
  locked: false,
  betaChannel: false,
  smartHibernation: true,
  workspaces: [
    { id: 'personal', name: 'Personal', email: 'you@gmail.com', color: '#4F46E5', active: 'p-wa', suspended: false,
      instances: [
        { id: 'p-fb', type: 'facebook',  unread: 3 },
        { id: 'p-ms', type: 'messenger', unread: 2 },
        { id: 'p-wa', type: 'whatsapp',  unread: 12 },
        { id: 'p-wb', type: 'whatsapp',  unread: 1, label: 'WhatsApp · Business', tag: 'B' },
        { id: 'p-ig', type: 'instagram', unread: 1 },
        { id: 'p-li', type: 'linkedin',  unread: 0 },
        { id: 'p-gm', type: 'gmail',     unread: 4 },
        { id: 'p-tg', type: 'custom',    unread: 0, label: 'Telegram', url: 'web.telegram.org', health: 'warn' },
      ] },
    { id: 'work', name: 'Work', email: 'you@company.com', color: '#0EA5E9', active: 'w-gm', suspended: false,
      instances: [
        { id: 'w-gm', type: 'gmail',    unread: 9 },
        { id: 'w-ca', type: 'calendar', unread: 0, dot: true },
        { id: 'w-ch', type: 'chat',     unread: 2 },
        { id: 'w-mt', type: 'meet',     unread: 0 },
        { id: 'w-li', type: 'linkedin', unread: 5 },
        { id: 'w-fb', type: 'facebook', unread: 0, label: 'Facebook · Page', state: 'signedout' },
      ] },
    { id: 'side', name: 'Side project', email: 'studio@gmail.com', color: '#10B981', active: 's-ig', suspended: true,
      instances: [
        { id: 's-ig', type: 'instagram', unread: 7 },
        { id: 's-fb', type: 'facebook',  unread: 0 },
        { id: 's-dr', type: 'drive',     unread: 0 },
      ] },
  ],
  notifications: [
    { id: 1, ws: 'personal', inst: 'p-wa', sender: 'Mom',          text: 'Are you coming for dinner tonight?',          ago: '2m',  vip: true },
    { id: 2, ws: 'personal', inst: 'p-wa', sender: 'Rahim',        text: 'Sent the photos from the trip 📸',              ago: '6m' },
    { id: 3, ws: 'work',     inst: 'w-li', sender: 'Rahim Uddin',  text: 'Thanks for connecting! Quick question about…',  ago: '11m' },
    { id: 4, ws: 'personal', inst: 'p-ms', sender: 'Sara Khan',    text: 'Did you see the event page?',                 ago: '18m' },
    { id: 5, ws: 'work',     inst: 'w-gm', sender: 'Emily Carter', text: 'Q4 roadmap review: agenda attached',          ago: '25m', vip: true },
    { id: 6, ws: 'personal', inst: 'p-fb', sender: 'Nadia Islam',  text: 'commented on your photo: "Beautiful!"',      ago: '40m' },
    { id: 7, ws: 'work',     inst: 'w-ch', sender: 'David Chen',   text: 'Deploy is green, merging now',                ago: '1h' },
    { id: 8, ws: 'side',     inst: 's-ig', sender: 'Arif Hossain', text: 'liked your reel',                             ago: '2h' },
  ],
  personLinks: { 'Rahim': 'Rahim Uddin' },
  pins: [
    { ws: 'personal', inst: 'p-fb', title: 'Dhaka Photographers (group)', url: 'facebook.com/groups/dhakaphoto' },
    { ws: 'work',     inst: 'w-li', title: 'Emily Carter (profile)',      url: 'linkedin.com/in/emilycarter' },
    { ws: 'personal', inst: 'p-ms', title: 'Family chat',                 url: 'facebook.com/messages/t/family' },
  ],
  replies: [
    "Thanks! I'll get back to you shortly.",
    'Sorry, I am in a meeting. Will call you later.',
    'My address: House 12, Road 5, Dhanmondi, Dhaka',
    "Sounds good. Let's talk tomorrow at 10.",
  ],
  downloads: [
    { name: 'trip-photos.zip',       size: '48.2 MB', from: 'p-wa', ws: 'personal', ago: '5m' },
    { name: 'Q4-roadmap.pdf',        size: '2.1 MB',  from: 'w-gm', ws: 'work',     ago: '24m' },
    { name: 'event-poster.png',      size: '860 KB',  from: 'p-ms', ws: 'personal', ago: '1h' },
  ],
  usageToday: [ // minutes
    { inst: 'p-wa', ws: 'personal', min: 54 }, { inst: 'p-fb', ws: 'personal', min: 32, budget: 30 },
    { inst: 'w-gm', ws: 'work', min: 47 },     { inst: 'p-ig', ws: 'personal', min: 21, budget: 20 },
    { inst: 'w-li', ws: 'work', min: 18, budget: 30 }, { inst: 'p-ms', ws: 'personal', min: 12 },
    { inst: 'w-ch', ws: 'work', min: 9 },
  ],
  usageWeek: [142, 188, 165, 210, 176, 98, 193],
};

const SAMPLE_INCOMING = [
  { ws: 'personal', inst: 'p-wa', sender: 'Rahim',        text: 'Are we still on for Friday?' },
  { ws: 'personal', inst: 'p-ig', sender: 'Nadia Islam',  text: 'sent you a message' },
  { ws: 'work',     inst: 'w-gm', sender: 'HR Team',      text: 'Your leave request was approved' },
  { ws: 'personal', inst: 'p-fb', sender: 'Sara Khan',    text: 'invited you to "Weekend Hike"' },
  { ws: 'work',     inst: 'w-li', sender: 'Recruiter',    text: 'New opportunity: Senior Engineer' },
  { ws: 'work',     inst: 'w-ch', sender: 'David Chen',   text: 'Can you review my PR?' },
  { ws: 'personal', inst: 'p-ms', sender: 'Arif Hossain', text: 'Haha that video 😂' },
];
const VIP_INCOMING = { ws: 'personal', inst: 'p-wa', sender: 'Mom', text: 'Call me when you are free ❤️' };
