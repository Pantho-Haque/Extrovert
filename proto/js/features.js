/* Extrovert prototype: feature demos (notifications, palette, call bubble, privacy, wellbeing, settings…). */

const VIPS = new Set(['Mom', 'Emily Carter']);
STATE.snoozed = [];
let nextNotifId = 100;
let sampleIdx = 0;

/* ================= Notifications ================= */
function incoming(n) {
  const { w, i } = findInst(n.inst);
  const vip = VIPS.has(n.sender);
  STATE.notifications.unshift({ ...n, id: nextNotifId++, ago: 'now', vip });
  i.unread++;
  popped.add(i.id); popped.add(w.id === STATE.activeWs ? w.id : 'acct');
  renderSidebar(); renderDock();
  if ($('#nc').classList.contains('open')) renderNC();

  const quietByHours = STATE.afterHours && w.id === 'work';
  if (!vip && (STATE.dnd || quietByHours)) return snack(`${STATE.dnd ? 'Do Not Disturb' : 'Work hours'}: alert from ${instName(i)} held. Badge still updated.`, [], 2500);
  if (!vip && STATE.digest) {
    STATE.digestQueue.push(n);
    renderSidebar();
    return snack(`Added to digest (${STATE.digestQueue.length} waiting). Badge still updated.`, [{ label: 'Deliver now', run: deliverDigest }], 3000);
  }
  const hide = STATE.sharing;
  osToast({
    logoHtml: hide ? logo('custom', 34) : av(n.sender, 34),
    app: `Extrovert · ${hide ? 'Hidden while sharing' : `${instName(i)} · ${w.name}`}`,
    title: hide ? 'New notification' : `${vip ? '★ ' : ''}${n.sender}`,
    body: hide ? 'Preview hidden by Screen-share shield' : n.text,
    actions: [{ label: 'Open', run: () => openInst(w.id, i.id) }, { label: 'Snooze', run: () => snooze(n) }],
    onClick: () => openInst(w.id, i.id),
  });
}

function simulateIncoming() { incoming(SAMPLE_INCOMING[sampleIdx++ % SAMPLE_INCOMING.length]); }
function simulateVip() { incoming(VIP_INCOMING); }

function deliverDigest() {
  if (!STATE.digestQueue.length) return snack('Digest is empty.');
  const q = STATE.digestQueue.splice(0);
  const apps = [...new Set(q.map(n => instName(findInst(n.inst).i)))];
  osToast({
    logoHtml: `<span class="digest-ic">${icon('clock', 18)}</span>`, app: 'Extrovert · Digest',
    title: `${q.length} notifications from ${apps.length} service${apps.length > 1 ? 's' : ''}`,
    body: q.slice(0, 3).map(n => `${n.sender}: ${n.text}`).join('<br>') + (q.length > 3 ? `<br>+${q.length - 3} more` : ''),
    actions: [{ label: 'Review all', run: () => openNC() }], ttl: 9000,
  });
  renderSidebar();
}

function snooze(n) {
  STATE.snoozed.push(n);
  snack(`Snoozed "${n.sender}". Demo: it comes back in 8 s (real choices: 15 min, 1 h, tonight, tomorrow).`, [], 3500);
  if ($('#nc').classList.contains('open')) renderNC();
  setTimeout(() => {
    STATE.snoozed = STATE.snoozed.filter(x => x !== n);
    const { w, i } = findInst(n.inst);
    osToast({
      logoHtml: av(n.sender, 34), app: `Extrovert · Snoozed reminder · ${instName(i)}`,
      title: n.sender, body: n.text,
      actions: [{ label: 'Open chat', run: () => { openInst(w.id, i.id); snack(`Opened the exact conversation with ${n.sender}.`); } }],
      onClick: () => openInst(w.id, i.id), ttl: 9000,
    });
    if ($('#nc').classList.contains('open')) renderNC();
  }, 8000);
}

function nextUnread() {
  const list = STATE.workspaces.filter(w => !w.suspended).flatMap(w => w.instances.filter(i => (i.unread || i.dot) && !i.state).map(i => ({ w, i })));
  if (!list.length) return snack('Inbox zero everywhere 🎉');
  const cur = ws().active;
  const next = list.find(x => x.i.id !== cur) || list[0];
  openInst(next.w.id, next.i.id);
  snack(`Next unread → ${instName(next.i)} · ${next.w.name}${next.i.unread ? ` (${next.i.unread})` : ''}. Press ⌘J again for the next one.`, [], 2500);
}

/* ---------- Notification center (history, people, snoozed) ---------- */
let ncTab = 'all', ncWs = 'all', ncQuery = '';
const canonical = (name) => STATE.personLinks[name] || name;

function openNC() { $('#nc').classList.add('open'); renderNC(); }

function renderNC() {
  const list = STATE.notifications.filter(n => (ncWs === 'all' || n.ws === ncWs) && (`${n.sender} ${n.text}`).toLowerCase().includes(ncQuery.toLowerCase()));
  const body = ncTab === 'people' ? peopleView(list) : ncTab === 'snoozed' ? snoozedView() : list.map(notifRow).join('') || '<p class="empty">Nothing here.</p>';
  $('#nc').innerHTML = `
    <div class="nc-h"><h3>Notifications</h3><button class="icon-btn" data-act="nc" aria-label="Close">${icon('x', 18)}</button></div>
    ${STATE.digestQueue.length ? `<div class="nc-digest">${icon('clock', 16)} ${STATE.digestQueue.length} held for your next digest <button class="btn sm" data-act="deliver-digest">Deliver now</button></div>` : ''}
    ${STATE.dnd ? `<div class="nc-digest dnd">${icon('moon', 16)} Do Not Disturb is on. VIPs still get through. <button class="btn sm" data-act="toggle-dnd">Turn off</button></div>` : ''}
    <div class="nc-search">${icon('search', 14)}<input id="nc-q" placeholder="Search notifications" value="${ncQuery}"></div>
    <div class="seg">${[['all', 'All'], ['people', 'People'], ['snoozed', `Snoozed${STATE.snoozed.length ? ` (${STATE.snoozed.length})` : ''}`]].map(([k, t]) => `<button class="${ncTab === k ? 'on' : ''}" data-act="nc-tab" data-k="${k}">${t}</button>`).join('')}</div>
    <div class="chips">${[['all', 'All workspaces'], ...STATE.workspaces.map(w => [w.id, w.name])].map(([k, t]) => `<button class="chip ${ncWs === k ? 'on' : ''}" data-act="nc-ws" data-k="${k}">${t}</button>`).join('')}</div>
    <div class="nc-list">${body}</div>`;
  const q = $('#nc-q');
  q.oninput = () => { ncQuery = q.value; renderNC(); const el = $('#nc-q'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); };
}

function notifRow(n) {
  const { w, i } = findInst(n.inst);
  const vip = VIPS.has(n.sender);
  return `<div class="nrow" data-open="${w.id}:${i.id}">
    <div class="nrow-av">${av(n.sender, 36)}<span class="nrow-logo">${logo(i.type, 16)}</span></div>
    <div class="nrow-m"><b>${vip ? `<span class="vip">${icon('star', 11)}</span>` : ''}${n.sender}</b><p>${n.text}</p><small>${instName(i)} · ${w.name} · ${n.ago}</small></div>
    <div class="nrow-a">
      <button class="icon-btn ${vip ? 'vip-on' : ''}" data-act="toggle-vip" data-name="${n.sender}" title="${vip ? 'Remove VIP' : 'Mark as VIP'}">${icon('star', 15)}</button>
      <button class="icon-btn" data-act="nc-snooze" data-id="${n.id}" title="Snooze">${icon('clock', 15)}</button>
    </div>
    <div class="snooze-opts" id="so-${n.id}">${['15 min', '1 hour', 'Tonight', 'Tomorrow'].map(t => `<button class="chip" data-act="do-snooze" data-id="${n.id}">${t}</button>`).join('')}</div>
  </div>`;
}

function peopleView(list) {
  const groups = {};
  list.forEach(n => {
    const key = canonical(n.sender);
    (groups[key] ||= { names: new Set(), items: [] });
    groups[key].names.add(n.sender); groups[key].items.push(n);
  });
  return `<p class="hint">${icon('users', 14)} Who is waiting on you, grouped by person across every platform.</p>` + Object.entries(groups).map(([name, g]) => {
    const byApp = {};
    g.items.forEach(n => { const t = findInst(n.inst).i.type; byApp[t] = (byApp[t] || 0) + 1; });
    const linked = g.names.size > 1;
    const first = g.items[0];
    return `<div class="prow" data-open="${first.ws}:${first.inst}">
      ${av(name, 40)}<div class="nrow-m"><b>${VIPS.has(name) || [...g.names].some(x => VIPS.has(x)) ? `<span class="vip">${icon('star', 11)}</span>` : ''}${name}</b>
      ${linked ? `<small class="linked">${icon('link', 11)} Linked: ${[...g.names].join(' + ')}</small>` : ''}
      <div class="papps">${Object.entries(byApp).map(([t, c]) => `<span>${logo(t, 16)} ${c} ${CATALOG[t].name}</span>`).join('')}</div></div>
      ${!linked && name === 'Sara Khan' ? '<button class="btn sm" data-act="link-names">Link names</button>' : ''}
    </div>`;
  }).join('');
}

function snoozedView() {
  if (!STATE.snoozed.length) return '<p class="empty">No snoozed notifications. Snooze one from the All tab or from a notification.</p>';
  return STATE.snoozed.map(n => `<div class="nrow">${av(n.sender, 36)}<div class="nrow-m"><b>${n.sender}</b><p>${n.text}</p><small>${icon('clock', 11)} Back in a few seconds (demo)</small></div></div>`).join('');
}

/* ================= Away recap & auto-recover ================= */
function awayRecap() {
  const groups = STATE.workspaces.map(w => {
    const ns = STATE.notifications.filter(n => n.ws === w.id);
    if (!ns.length) return '';
    const people = {};
    ns.forEach(n => { const k = canonical(n.sender); (people[k] ||= []).push(n); });
    return `<div class="recap-ws"><div class="recap-wsh"><span class="dotc" style="background:${w.color}"></span><b>${w.name}</b><small>${ns.length} new</small></div>
      ${Object.entries(people).map(([p, list]) => `<div class="recap-row" data-open="${list[0].ws}:${list[0].inst}">${av(p, 28)}<b>${p}</b><span class="recap-apps">${[...new Set(list.map(n => findInst(n.inst).i.type))].map(t => logo(t, 16)).join('')}</span><small>${list.length} · ${list[0].text}</small></div>`).join('')}</div>`;
  }).join('');
  openModal('While you were away', `
    <div class="recap-top">${icon('coffee', 20)}<div><b>Welcome back. You were away for 2 h 14 min.</b><p>Here's who reached out, grouped by person. Click any row to open that conversation.</p></div></div>
    ${groups}
    <div class="modal-f"><button class="btn" data-act="close-modal">Dismiss</button><button class="btn primary" data-act="recap-catchup">Start catching up (⌘J)</button></div>`);
}

function wakeFromSleep() {
  snack(`${icon('refresh', 14)} Back online after sleep. Reloaded 2 stuck services: WhatsApp, Messenger.`, [], 4000);
  setTimeout(awayRecap, 900);
}

/* ================= Command palette & saved replies ================= */
let palItems = [], palSel = 0;
function openPalette(mode = 'cmd') {
  $('#palette-root').innerHTML = `<div class="pal-backdrop" data-act="close-palette"><div class="palette" data-stop>
    <div class="pal-in">${icon(mode === 'replies' ? 'type' : 'search', 18)}<input id="pal-q" placeholder="${mode === 'replies' ? 'Search saved replies…' : 'Jump to a service, pin or action. Or paste a link…'}" autocomplete="off"></div>
    <div class="pal-list" id="pal-list"></div>
    <div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> ${mode === 'replies' ? 'paste' : 'open'}</span><span><kbd>esc</kbd> close</span>${mode === 'cmd' ? '<span class="tip">Try pasting <code>instagram.com/nadia.clicks</code></span>' : ''}</div>
  </div></div>`;
  const q = $('#pal-q');
  const render = () => { palItems = mode === 'replies' ? replyItems(q.value) : paletteItems(q.value); palSel = 0; drawPalette(); };
  q.oninput = render;
  q.onkeydown = (e) => {
    if (e.key === 'ArrowDown') { palSel = Math.min(palSel + 1, palItems.length - 1); drawPalette(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { palSel = Math.max(palSel - 1, 0); drawPalette(); e.preventDefault(); }
    if (e.key === 'Enter' && palItems[palSel]) runPal(palSel);
  };
  render(); q.focus();
}
const openReplies = () => openPalette('replies');
const closePalette = () => { $('#palette-root').innerHTML = ''; };

function paletteItems(q) {
  const s = q.trim().toLowerCase();
  const items = [];
  if (/\.(com|org|net)|^https?:/.test(s)) {
    const type = Object.keys(CATALOG).find(t => CATALOG[t].url && s.includes(CATALOG[t].url.split('/')[0].replace('www.', '')));
    STATE.workspaces.forEach(w => w.instances.filter(i => i.type === type).forEach(i =>
      items.push({ group: 'Open link in the right place', html: `${logo(i.type, 22)}<b>Open in ${instName(i)}</b><span>${w.name}</span><small>${q.trim()}</small>`, run: () => { openInst(w.id, i.id); snack(`Opened the link inside ${instName(i)} · ${w.name}, not in an outside browser.`); } })));
    if (!items.length) items.push({ group: 'Open link', html: `${icon('globe', 20)}<b>Open in system browser</b><small>No matching service</small>`, run: () => snack('Opened in your default browser.') });
    return items;
  }
  STATE.workspaces.forEach(w => w.instances.forEach(i => items.push({ group: 'Services', text: `${instName(i)} ${w.name}`, html: `${logo(i.type, 22)}<b>${instName(i)}</b><span>${w.name}</span>${i.unread ? `<em class="badge inline">${i.unread}</em>` : ''}`, run: () => openInst(w.id, i.id) })));
  STATE.pins.forEach(p => { const { i } = findInst(p.inst); items.push({ group: 'Pins', text: p.title, html: `${icon('pin', 18)}<b>${p.title}</b><span>${instName(i)} · ${ws(p.ws).name}</span>`, run: () => openInst(p.ws, p.inst) }); });
  [['Jump to next unread', 'zap', nextUnread, '⌘J'], ['Toggle Do Not Disturb', 'moon', () => ACTIONS['toggle-dnd'](), ''], ['Time insights', 'chart', showInsights, ''], ['Task manager', 'activity', showTaskManager, ''],
    ['Zen mode', 'expand', toggleZen, '⌘\\'], ['Saved replies', 'type', openReplies, '⌘⇧V'], ['Lock & blur', 'lock', lockApp, '⌘⇧L'], ['Notification center', 'bell', openNC, ''], ['Settings', 'gear', () => ACTIONS.settings(), '⌘,']]
    .forEach(([t, ic, run, k]) => items.push({ group: 'Actions', text: t, html: `${icon(ic, 18)}<b>${t}</b>${k ? `<kbd>${k}</kbd>` : ''}`, run }));
  return s ? items.filter(x => x.text.toLowerCase().includes(s)) : items;
}

function replyItems(q) {
  return STATE.replies.filter(r => r.toLowerCase().includes(q.toLowerCase())).map(r => ({
    group: 'Saved replies', html: `${icon('msg', 16)}<b class="reply-t">${r}</b>`,
    run: () => { const { i } = findInst(ws().active); snack(`Pasted into ${instName(i)}'s message box, exactly like pressing ⌘V.`); },
  })).concat([{ group: 'Manage', html: `${icon('gear', 16)}<b>Manage saved replies</b>`, run: () => ACTIONS.settings(null, null, 'notifications') }]);
}

function drawPalette() {
  let last = '';
  $('#pal-list').innerHTML = palItems.map((it, k) => {
    const head = it.group !== last ? `<div class="pal-g">${(last = it.group)}</div>` : '';
    return `${head}<div class="pal-item ${k === palSel ? 'sel' : ''}" data-act="pal-run" data-k="${k}">${it.html}</div>`;
  }).join('') || '<p class="empty">No matches</p>';
  $('.pal-item.sel')?.scrollIntoView({ block: 'nearest' });
}
function runPal(k) { const it = palItems[k]; closePalette(); it.run(); }

/* ================= Find, Zen, Lock ================= */
function toggleFind(show) {
  const fb = $('#findbar');
  if (!show) return fb.classList.remove('show');
  fb.innerHTML = `${icon('search', 14)}<input placeholder="Find in page" value=""><span class="count">0 of 0</span><button class="icon-btn">${icon('up', 14)}</button><button class="icon-btn">${icon('down', 14)}</button><button class="icon-btn" data-act="close-find">${icon('x', 14)}</button>`;
  fb.classList.add('show');
  const inp = $('input', fb);
  inp.oninput = () => { $('.count', fb).textContent = inp.value ? `1 of ${3 + inp.value.length}` : '0 of 0'; };
  inp.focus();
}

function toggleZen() {
  STATE.zen = !STATE.zen;
  $('#win').classList.toggle('zen', STATE.zen);
  snack(STATE.zen ? 'Zen mode: sidebar hidden. Notifications still reach you. Press ⌘\\ to exit.' : 'Sidebar is back.', STATE.zen ? [{ label: 'Exit', run: toggleZen }] : [], 3000);
}

function lockApp() {
  STATE.locked = true;
  $('#lock-root').innerHTML = `<div class="lock"><div class="lock-card">${brand(52)}<h2>Extrovert is locked</h2><p>The window is blurred, and notifications and sounds are muted.</p>
    <div class="pin">${'<i></i>'.repeat(4)}</div><input id="pin-in" maxlength="4" inputmode="numeric" placeholder="Enter PIN (any 4 digits)">
    <button class="btn primary" data-act="unlock">${icon('lock', 16)} Unlock with Touch ID</button></div></div>`;
  const pin = $('#pin-in');
  pin.focus();
  pin.oninput = () => {
    $$('.pin i').forEach((d, k) => d.classList.toggle('on', k < pin.value.length));
    if (pin.value.length === 4) setTimeout(unlock, 250);
  };
}
function unlock() { STATE.locked = false; $('#lock-root').innerHTML = ''; }

/* ================= Call bubble & media ================= */
function startCall() {
  STATE.call = { inst: 'p-wa', with: 'Mom', start: Date.now() };
  findInst('p-wa').i.media = 'video';
  openInst('personal', 'p-wa');
  snack('Video call started in WhatsApp. Note the camera dot on its icon. Now switch to another service to see the call bubble.', [], 5000);
}

function maybeCallBubble() {
  const b = $('#call-bubble');
  if (!STATE.call) return b.classList.remove('show');
  const { w, i } = findInst(STATE.call.inst);
  const onCall = STATE.activeWs === w.id && ws().active === i.id;
  if (onCall) return b.classList.remove('show');
  b.innerHTML = `<div class="cb-video">${av(STATE.call.with, 64)}<span class="cb-self">${av('You', 26)}</span></div>
    <div class="cb-bar"><div><b>${STATE.call.with}</b><small>${logo('whatsapp', 12)} WhatsApp · ${w.name} · <span data-btimer>00:00</span></small></div>
    <button class="icon-btn" title="Mute">${icon('mic', 15)}</button><button class="icon-btn" data-act="return-call" title="Back to call">${icon('expand', 15)}</button><button class="icon-btn end" data-act="end-call" title="End">${icon('phone', 15)}</button></div>`;
  b.classList.add('show');
}

function endCall() {
  if (!STATE.call) return;
  findInst(STATE.call.inst).i.media = null;
  STATE.call = null;
  $('#call-bubble').classList.remove('show');
  renderAll();
  snack('Call ended.');
}

function makeDraggable(el) {
  let sx, sy, ox, oy;
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const r = el.getBoundingClientRect();
    sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (sx === undefined) return;
    Object.assign(el.style, { left: ox + e.clientX - sx + 'px', top: oy + e.clientY - sy + 'px', right: 'auto', bottom: 'auto' });
  });
  el.addEventListener('pointerup', () => { sx = undefined; });
}

function startShare() {
  STATE.sharing = true;
  findInst('w-mt').i.media = 'screen';
  openInst('work', 'w-mt');
  $('#share-banner').classList.add('show');
  renderAll();
  setTimeout(simulateIncoming, 1800);
}
function stopShare() {
  STATE.sharing = false;
  findInst('w-mt').i.media = null;
  $('#share-banner').classList.remove('show');
  renderAll();
  snack('Screen sharing stopped. Previews are visible again.');
}

/* ================= Wellbeing ================= */
function feedGuard() {
  const { i } = findInst(ws().active);
  if (CATALOG[i.type].kind !== 'feed') openInst('personal', 'p-fb');
  const cur = findInst(ws().active).i;
  $('#view-overlay').innerHTML = `<div class="fg"><div class="fg-card">
    <div class="ring" style="--p:100">${logo(cur.type, 40)}</div>
    <h2>Still want to scroll?</h2>
    <p>You've spent <b>32 min</b> on ${instName(cur)} today. Your daily budget is <b>30 min</b>.</p>
    <small>Messaging apps are never limited. Feed guard is opt-in and can be changed in Settings → Wellbeing.</small>
    <div class="fg-a"><button class="btn" data-act="fg-continue">Continue 10 more min</button><button class="btn primary" data-act="fg-break">${icon('coffee', 16)} Take a break</button></div>
  </div></div>`;
}

function showInsights(tab = 'today') {
  const rows = [...STATE.usageToday].sort((a, b) => b.min - a.min);
  const max = rows[0].min;
  const total = rows.reduce((n, r) => n + r.min, 0);
  const fmt = (m) => `${Math.floor(m / 60) ? Math.floor(m / 60) + ' h ' : ''}${m % 60} min`;
  const perWs = STATE.workspaces.map(w => ({ w, m: rows.filter(r => r.ws === w.id).reduce((n, r) => n + r.min, 0) })).filter(x => x.m);
  const today = `
    <div class="ins-top"><div><small>Today</small><h2>${fmt(total)}</h2></div>${perWs.map(({ w, m }) => `<div class="ins-ws"><span class="dotc" style="background:${w.color}"></span>${w.name}<b>${fmt(m)}</b></div>`).join('')}</div>
    <div class="ins-rows">${rows.map(r => {
      const { w, i } = findInst(r.inst);
      const over = r.budget && r.min > r.budget;
      return `<div class="ins-row">${logo(i.type, 26)}<div class="ins-name"><b>${instName(i)}</b><small>${w.name}</small></div>
        <div class="ins-bar"><span class="${over ? 'over' : ''}" style="width:${(r.min / max) * 100}%"></span>${r.budget ? `<i class="budget" style="left:${(r.budget / max) * 100}%" title="Budget ${r.budget} min"></i>` : ''}</div>
        <b class="ins-v ${over ? 'over-t' : ''}">${r.min} min${r.budget ? `<small>/ ${r.budget}</small>` : ''}</b></div>`;
    }).join('')}</div>`;
  const wmax = Math.max(...STATE.usageWeek);
  const week = `<div class="ins-top"><div><small>This week · daily average</small><h2>${fmt(Math.round(STATE.usageWeek.reduce((a, b) => a + b) / 7))}</h2></div><div class="ins-ws trend">${icon('down', 14)} 12% less than last week</div></div>
    <div class="week">${STATE.usageWeek.map((m, k) => `<div class="wk"><span style="height:${(m / wmax) * 100}%" title="${fmt(m)}"></span><small>${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][k]}</small></div>`).join('')}</div>`;
  openModal('Time insights', `
    <div class="seg"><button class="${tab === 'today' ? 'on' : ''}" data-act="ins-tab" data-k="today">Today</button><button class="${tab === 'week' ? 'on' : ''}" data-act="ins-tab" data-k="week">This week</button></div>
    ${tab === 'today' ? today : week}
    <div class="note">${icon('clock', 16)}<p><b>How time is counted:</b> only while the Extrovert window is focused, the service is on screen, <i>and</i> you're active (keyboard/mouse in the last 60 s) or it's playing video/audio. It stops when you switch apps, minimize, lock the screen or switch service. Stored only on this device.</p></div>`, { wide: true });
}

/* ================= Performance ================= */
const MEM = { facebook: 420, messenger: 260, whatsapp: 310, instagram: 380, linkedin: 340, gmail: 290, calendar: 180, drive: 210, meet: 240, chat: 200, custom: 160 };
function showTaskManager() {
  const rows = STATE.workspaces.flatMap(w => w.instances.map(i => {
    const asleep = w.suspended || i.state === 'sleeping' || i.state === 'signedout';
    const mem = asleep ? 0 : MEM[i.type] + (i.unread * 3);
    return { w, i, mem, cpu: asleep ? 0 : ((MEM[i.type] % 37) / 10 + (i.id === STATE.call?.inst ? 14 : 0)).toFixed(1), status: w.suspended ? 'Paused' : i.state === 'sleeping' ? 'Sleeping' : i.state === 'signedout' ? 'Signed out' : 'Live' };
  }));
  const total = rows.reduce((n, r) => n + r.mem, 0);
  openModal('Task manager', `
    <div class="tm-top"><div><small>Extrovert memory</small><h2>${(total / 1024).toFixed(1)} GB <span>of 16 GB</span></h2></div>
      <label class="row-inline">Smart hibernation <label class="switch"><input type="checkbox" data-set="smartHibernation" ${STATE.smartHibernation ? 'checked' : ''}><span></span></label></label>
      <button class="btn" data-act="mem-pressure">${icon('zap', 15)} Simulate low memory</button></div>
    <table class="tm"><thead><tr><th>Service</th><th>Workspace</th><th>Status</th><th>Memory</th><th>CPU</th><th></th></tr></thead><tbody>
    ${rows.sort((a, b) => b.mem - a.mem).map(({ w, i, mem, cpu, status }) => `<tr>
      <td>${logo(i.type, 22)} ${instName(i)}</td><td><span class="dotc" style="background:${w.color}"></span>${w.name}</td>
      <td><span class="st st-${status.split(' ')[0].toLowerCase()}">${status}</span></td>
      <td><div class="membar"><span style="width:${(mem / 500) * 100}%"></span></div>${mem} MB</td><td>${cpu}%</td>
      <td class="tm-a">${status === 'Live' ? `<button class="btn sm" data-act="tm-sleep" data-id="${i.id}">Sleep</button>` : ''}<button class="btn sm" data-act="ctx-reload" data-id="${i.id}">Reload</button></td></tr>`).join('')}
    </tbody></table>`, { wide: true });
}

function memoryPressure() {
  const { i } = findInst('p-ig');
  i.state = 'sleeping';
  renderAll();
  showTaskManager();
  snack('Low memory: Smart hibernation put Instagram (Personal), your least-used feed, to sleep. Messaging apps stay awake.', [], 5000);
}

function setState(state) {
  const { i } = findInst(ws().active);
  i.state = state;
  renderAll();
  if (state === 'loading') setTimeout(() => { i.state = undefined; renderAll(); }, 1500);
}

function sessionExpired() {
  const { w, i } = findInst('p-ig');
  i.state = 'signedout';
  renderAll();
  osToast({ logoHtml: logo('instagram', 34), app: 'Extrovert · Login watchdog', title: 'Instagram signed you out', body: 'Personal workspace. Sign in again to keep getting notifications.', actions: [{ label: 'Sign in', run: () => openInst(w.id, i.id) }] });
}

/* ================= Accounts, services, onboarding ================= */
function addServiceModal() {
  const w = ws();
  const card = (t) => `<button class="cat" data-act="add-type" data-type="${t}">${logo(t, 40)}<b>${CATALOG[t].name}</b>${w.instances.some(i => i.type === t) ? '<small>+ another account</small>' : ''}</button>`;
  openModal('Add a service', `
    <p class="muted">Adding to <b style="color:${w.color}">${w.name}</b>. Each service gets its own login, isolated from every other workspace.</p>
    <h5>Social</h5><div class="cat-grid">${['facebook', 'messenger', 'whatsapp', 'instagram', 'linkedin'].map(card).join('')}</div>
    <h5>Google</h5><div class="cat-grid">${['gmail', 'calendar', 'drive', 'meet', 'chat'].map(card).join('')}</div>
    <h5>Any website</h5>
    <div class="custom-url"><span>${icon('link', 16)}</span><input id="cu-in" placeholder="Paste a URL, e.g. web.telegram.org"><button class="btn primary" data-act="add-custom">Add</button></div>
    <div id="cu-prev" class="cu-prev"></div>`, { wide: true });
  const inp = $('#cu-in');
  inp.oninput = () => {
    const host = inp.value.replace(/^https?:\/\//, '').split('/')[0];
    const name = host.split('.').filter(p => !['www', 'web', 'app', 'com', 'org', 'net', 'io'].includes(p))[0] || '';
    $('#cu-prev').innerHTML = name ? `${logo('custom', 28)}<div><b>${name[0].toUpperCase() + name.slice(1)}</b><small>Detected from ${host}. Name and icon can be edited.</small></div>` : '';
  };
}

function addInstance(type, extra = {}) {
  const w = ws();
  const inst = { id: `${w.id}-${type}-${Date.now()}`, type, unread: 0, state: 'loading', ...extra };
  if (type !== 'custom' && w.instances.some(i => i.type === type)) inst.label = `${CATALOG[type].name} 2`;
  w.instances.push(inst);
  closeModal();
  switchService(inst.id);
  setTimeout(() => { inst.state = undefined; renderAll(); }, 1400);
  snack(`${instName(inst)} added to ${w.name}. Log in on its own page. Extrovert never sees your password.`);
}

function addAccountModal() {
  openModal('Add a Google account', `
    <div class="gsign">${brand(48)}<p>Each Google account becomes its own <b>workspace</b>, with separate logins for every service. Switch between them with one click.</p>
    <button class="btn google" data-act="google-signin"><span class="g">G</span> Sign in with Google</button>
    <small>${icon('globe', 12)} Opens in your browser (secure OAuth). Extrovert only receives your name, email and photo.</small></div>`);
}

function googleSignIn() {
  $('.gsign').innerHTML = `<div class="spinner"></div><p>Waiting for you to finish signing in in your browser…</p>`;
  setTimeout(() => {
    closeModal();
    const next = NEW_ACCOUNTS.find(a => !STATE.workspaces.some(w => w.email === a.email));
    if (!next) return snack('That Google account is already signed in. Pick it from the account menu instead.');
    const id = `ws-${STATE.workspaces.length}`;
    STATE.workspaces.push({ id, ...next, active: `${id}-gm`, suspended: false,
      instances: [{ id: `${id}-gm`, type: 'gmail', unread: 2 }, { id: `${id}-wa`, type: 'whatsapp', unread: 0 }] });
    switchWorkspace(id);
    snack(`Workspace "${next.name}" created from ${next.email}. Switch anytime from the account menu or ⌘⇧${STATE.workspaces.length}.`);
  }, 1500);
}

const NEW_ACCOUNTS = [
  { name: 'Freelance', email: 'you.freelance@gmail.com', color: '#F59E0B' },
  { name: 'Family', email: 'family.home@gmail.com', color: '#EC4899' },
];

let obStep = 1;
function onboarding(step = 1) {
  obStep = step;
  const steps = {
    1: `<div class="ob-c">${brand(72)}<h1>Welcome to Extrovert</h1><p class="lead">All your communities. One space.</p>
        <div class="ob-logos">${['facebook', 'messenger', 'whatsapp', 'instagram', 'linkedin', 'gmail', 'calendar', 'meet'].map(t => logo(t, 36)).join('')}<span class="ob-more">+ any site</span></div>
        <button class="btn google big" data-act="ob-next"><span class="g">G</span> Continue with Google</button>
        <div class="ob-props">
          <div>${icon('globe', 18)}<b>Every app, untouched</b><small>The real websites, exactly as you know them.</small></div>
          <div>${icon('bell', 18)}<b>Never miss a thing</b><small>Live badges on every tab, every account.</small></div>
          <div>${icon('shield', 18)}<b>Private by design</b><small>No tracking. We never see your passwords.</small></div>
        </div>
        <small class="muted">Your Google account is only used to create your workspace (name, email, photo).</small></div>`,
    2: `<div class="ob-c wide"><span class="step">Step 2 of 3</span><h1>Pick your services</h1><p class="lead">You can add more anytime, including any website by URL.</p>
        <div class="ob-grid">${['facebook', 'messenger', 'whatsapp', 'instagram', 'linkedin', 'gmail', 'calendar', 'drive', 'meet', 'chat'].map((t, k) => `<label class="ob-svc"><input type="checkbox" ${k < 6 ? 'checked' : ''}>${logo(t, 40)}<b>${CATALOG[t].name}</b><i>${icon('check', 12)}</i></label>`).join('')}</div>
        <div class="custom-url"><span>${icon('link', 16)}</span><input placeholder="Add a custom URL (optional)"></div>
        <button class="linkish" data-act="ob-ferdium">${icon('upload', 14)} Coming from Ferdium? Import your services</button>
        <div id="ob-imp"></div>
        <div class="ob-f"><button class="btn" data-act="ob-back">Back</button><button class="btn primary" data-act="ob-next">Continue</button></div></div>`,
    3: `<div class="ob-c"><span class="step">Step 3 of 3</span><h1>You're all set</h1><p class="lead">A few shortcuts worth knowing:</p>
        <div class="ob-keys">${[['⌘K', 'Jump anywhere, or paste a link'], ['⌘J', 'Next unread, across all workspaces'], ['⌘1–9', 'Switch service'], ['⌘⇧1–9', 'Switch workspace'], ['⌥ + hover', 'Peek at a service'], ['⌘⇧L', 'Lock & blur instantly']].map(([k, t]) => `<div><kbd>${k}</kbd><span>${t}</span></div>`).join('')}</div>
        <div class="ob-f"><button class="btn" data-act="ob-back">Back</button><button class="btn primary" data-act="ob-done">Open my workspace</button></div></div>`,
  };
  $('#onboarding-root').innerHTML = `<div class="ob">${steps[step]}</div>`;
  $('#dock .badge')?.remove(); // no accounts yet → nothing unread
}

/* ================= Account switcher (Gmail-style) ================= */
function acctPopover() {
  const a = ws();
  const r = $('.acct-btn').getBoundingClientRect();
  const flag = (w) => STATE.afterHours && w.id === 'work' ? `<small class="acct-flag">${icon('moon', 11)} Outside work hours</small>` : w.suspended ? `<small class="acct-flag">${icon('clock', 11)} Paused</small>` : '';
  $('#popover').innerHTML = `<div class="popo acct-pop" role="menu" style="left:${r.right + 10}px;top:${r.top}px">
    <div class="acct-cur">
      <small>${a.email}</small>
      <span class="acct-big" style="--c:${a.color}">${a.name[0]}</span>
      <b>Hi, ${a.name}!</b>
      <button class="btn sm" data-act="settings" data-section="account">Manage this workspace</button>
    </div>
    <div class="acct-list ${STATE.sharing ? 'shielded' : ''}">
      ${STATE.workspaces.filter(w => w.id !== a.id).map(w => {
        const n = wsUnread(w);
        return `<button class="acct-row" role="menuitem" data-act="acct-switch" data-id="${w.id}">
          <span class="acct-av" style="--c:${w.color}">${w.name[0]}</span>
          <span class="acct-txt"><b>${w.name}</b><small>${w.email}</small>${flag(w)}</span>
          ${n ? `<em class="badge inline ${w.suspended ? 'grey' : ''}">${fmtBadge(n)}</em>` : ''}
        </button>`;
      }).join('')}
      <button class="acct-row add" role="menuitem" data-act="add-account"><span class="acct-plus">${icon('plus', 18)}</span><span class="acct-txt"><b>Add another account</b><small>Each Google account gets its own workspace</small></span></button>
    </div>
    <div class="acct-foot"><button class="linkish" data-act="noop">${icon('logout', 14)} Sign out of all accounts</button><small>⌘⇧1–9 to switch</small></div>
  </div>`;
}

/* ================= Popovers: downloads & tray ================= */
function downloadsPopover(anchor) {
  const r = anchor.getBoundingClientRect();
  $('#popover').innerHTML = `<div class="popo" style="left:${r.right + 10}px;bottom:${innerHeight - r.bottom}px">
    <div class="pop-h"><b>Downloads</b><button class="linkish" data-act="noop">Clear</button></div>
    ${STATE.downloads.map(d => { const { w, i } = findInst(d.from); return `<div class="dl">${icon('file', 22)}<div><b>${d.name}</b><small>${d.size} · ${logo(i.type, 12)} ${instName(i)} · ${w.name} · ${d.ago}</small></div><button class="icon-btn" data-act="noop" title="Show in folder">${icon('folder', 15)}</button></div>`; }).join('')}
  </div>`;
}

function trayPopover() {
  const r = $('#tray-btn').getBoundingClientRect();
  $('#popover').innerHTML = `<div class="popo tray" style="right:${innerWidth - r.right - 8}px;top:${r.bottom + 6}px">
    <div class="pop-h">${brand(20)}<b>Extrovert</b><label class="row-inline sm">DND <label class="switch sm"><input type="checkbox" data-set="dnd" ${STATE.dnd ? 'checked' : ''}><span></span></label></label></div>
    ${STATE.workspaces.map(w => `<div class="tray-ws"><div class="tray-wsh"><span class="dotc" style="background:${w.color}"></span><b>${w.name}</b>${wsUnread(w) ? `<em class="badge inline">${wsUnread(w)}</em>` : ''}</div>
      <div class="tray-svcs">${w.instances.filter(i => i.unread).map(i => `<span data-open="${w.id}:${i.id}">${logo(i.type, 20)}<b>${i.unread}</b></span>`).join('') || '<small class="muted">All caught up</small>'}</div></div>`).join('')}
    <div class="pop-h sub"><b>Latest</b></div>
    ${STATE.notifications.slice(0, 3).map(n => { const { i } = findInst(n.inst); return `<div class="tray-n" data-open="${n.ws}:${n.inst}">${logo(i.type, 16)}<b>${n.sender}</b><span>${n.text}</span></div>`; }).join('')}
    <button class="btn primary full" data-act="tray-open">Open Extrovert</button>
  </div>`;
}

/* ================= Updates ================= */
function updateReady() {
  snack(`${icon('download', 14)} Extrovert 1.2.0 is ready to install`, [{ label: 'Restart now', run: fakeRestart }, { label: 'Later' }], 0);
}
function fakeRestart() {
  $('#win').classList.add('restarting');
  setTimeout(() => { $('#win').classList.remove('restarting'); whatsNew(); }, 900);
}
function whatsNew() {
  openModal("What's new in 1.2.0", `
    <div class="wn">${[['users', 'People view', 'See who is waiting on you, grouped by person across platforms.'], ['clock', 'Snooze to the exact chat', 'Snoozed notifications reopen the exact conversation.'], ['shield', 'Screen-share shield', 'Previews hide automatically while you present.'], ['zap', 'Faster startup', 'Messaging apps load first, everything else follows.']]
      .map(([ic, t, d]) => `<div class="wn-i"><span>${icon(ic, 18)}</span><div><b>${t}</b><p>${d}</p></div></div>`).join('')}</div>
    <div class="modal-f"><button class="btn" data-act="feedback">Send feedback</button><button class="btn primary" data-act="close-modal">Got it</button></div>`);
}
function feedbackModal() {
  openModal('Send feedback', `
    <p class="muted">Nothing is sent automatically. Review everything below, then choose how to send it.</p>
    <textarea class="ta" placeholder="What happened? What did you expect?"></textarea>
    <div class="note">${icon('file', 16)}<p><b>Attached system info (editable):</b><br><code>Extrovert 1.2.0 · macOS 15.1 · Electron 33 · 3 workspaces · 16 services</code></p></div>
    <div class="modal-f"><button class="btn" data-act="noop">Copy to clipboard</button><button class="btn primary" data-act="feedback-send">Open as GitHub issue</button></div>`);
}

/* ================= Settings ================= */
let setSection = 'account';
const toggle = (key, on, data = '') => `<label class="switch"><input type="checkbox" ${key ? `data-set="${key}"` : ''} ${data} ${on ? 'checked' : ''}><span></span></label>`;
const srow = (t, d, ctrl) => `<div class="srow"><div><b>${t}</b>${d ? `<small>${d}</small>` : ''}</div><div class="sctrl">${ctrl}</div></div>`;

const SECTIONS = {
  account: ['Account & workspaces', 'users', () => `
    ${STATE.workspaces.map(w => `<div class="ws-card"><span class="ws-av sm" style="--c:${w.color}"><span class="ws-letter">${w.name[0]}</span></span>
      <div><input class="inline-in" value="${w.name}"><small>${w.email} · ${w.instances.length} services${w.suspended ? ' · paused' : ''}</small></div>
      <div class="swatches">${['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899'].map(c => `<i style="background:${c}" class="${c === w.color ? 'on' : ''}" data-act="ws-color" data-ws-id="${w.id}" data-c="${c}"></i>`).join('')}</div>
      <button class="btn sm danger-t" data-act="noop">Sign out…</button></div>`).join('')}
    <button class="btn" data-act="add-account">${icon('plus', 15)} Add Google account</button>
    <h5>Background</h5>
    ${srow('Keep background workspaces running', 'Badges stay live for every workspace. Uses more memory.', toggle(null, true))}
    ${srow('Pause inactive workspaces to save memory', 'Their badges show "paused" until you switch back.', toggle(null, false))}
    <h5>Work hours</h5>
    ${srow('Work', 'Muted outside these hours. VIPs still get through.', '<span class="pill sm">Mon–Fri</span><input class="time" type="time" value="09:00"> – <input class="time" type="time" value="18:00">')}
    ${srow('Open on the workspace whose hours are active', '', toggle(null, true))}
    <h5>Sync</h5>
    ${srow('Sync settings via your Google Drive', 'Stored in Drive\'s hidden app folder. No Extrovert server. Logins never sync.', toggle(null, true))}
    <h5>Network <span class="tag">Later</span></h5>
    ${srow('Proxy for "Work"', 'Only this workspace\'s traffic goes through it.', '<select><option>No proxy</option><option selected>proxy.company.com:8080</option></select>')}`],

  services: ['Services', 'globe', () => `
    <p class="muted">Services in <b>${ws().name}</b>. Every service keeps its own login.</p>
    <table class="svc-t"><thead><tr><th>Service</th><th>Badge signal</th><th>Badge</th><th>Alerts</th><th>Sound</th><th>Autoplay</th><th></th></tr></thead><tbody>
    ${ws().instances.map(i => `<tr><td>${logo(i.type, 24)}<div><b>${instName(i)}</b><small>${i.url || CATALOG[i.type].url}</small></div></td>
      <td>${i.health === 'warn' ? `<span class="health warn" title="No title or notification signal for 3 days while loaded">${icon('alert', 12)} No signal for 3 days</span>` : i.state === 'signedout' ? `<span class="health warn">${icon('alert', 12)} Signed out</span>` : `<span class="health ok">${icon('check', 12)} OK · 2 min ago</span>`}</td>
      <td>${toggle(null, true)}</td><td>${toggle(null, !i.muted)}</td><td>${toggle(null, i.type !== 'gmail')}</td><td>${CATALOG[i.type].kind === 'feed' ? toggle(null, false) : '<small class="muted">n/a</small>'}</td>
      <td><button class="icon-btn" data-act="noop" title="More">${icon('more', 16)}</button></td></tr>`).join('')}
    </tbody></table>
    <div class="note">${icon('alert', 16)}<p><b>Badge health:</b> if a service stops reporting unread counts (e.g. after a redesign), Extrovert warns you here instead of silently showing 0.</p></div>`],

  notifications: ['Notifications', 'bell', () => `
    ${srow('Do Not Disturb', 'Badges keep updating. Alerts and sounds pause. VIPs still get through.', toggle('dnd', STATE.dnd))}
    ${srow('Digest mode', 'Hold non-VIP alerts and deliver them together.', `${toggle('digest', STATE.digest)}<select><option>Every 30 min</option><option selected>Every hour</option><option>Every 2 hours</option><option>At 12:00 & 18:00</option></select>`)}
    ${srow('Show message previews', 'Sender and text in OS notifications.', toggle(null, true))}
    ${srow('While-you-were-away recap', 'After being away for more than', `${toggle(null, true)}<select><option>15 min</option><option>30 min</option><option>1 hour</option></select>`)}
    ${srow('Keep notification history for', 'Stored on this device only.', '<select><option>7 days</option><option selected>30 days</option><option>90 days</option></select>')}
    <h5>VIP people</h5>
    <p class="muted">Messages from these people break through DND, digests and work hours on every platform, with a distinct sound.</p>
    <div class="chips">${[...VIPS].map(v => `<span class="chip on">${icon('star', 11)} ${v} <b data-act="rm-vip" data-name="${v}">×</b></span>`).join('')}<input class="chip-in" id="vip-in" placeholder="+ Add a name"></div>
    <h5>Saved replies</h5>
    ${STATE.replies.map(r => `<div class="reply-row">${icon('msg', 14)}<span>${r}</span><button class="icon-btn" data-act="noop">${icon('x', 14)}</button></div>`).join('')}
    <button class="btn sm" data-act="noop">${icon('plus', 14)} New saved reply</button>`],

  privacy: ['Privacy & security', 'shield', () => `
    ${srow('App lock', 'Ask for PIN or Touch ID when opening Extrovert.', `${toggle(null, true)}<select><option>Lock after 10 min idle</option><option>Never</option></select>`)}
    ${srow('Panic key', 'Instantly blur, mute and lock.', '<kbd>⌘⇧L</kbd>')}
    ${srow('Blur when idle', 'Blur the window after 5 min without activity.', toggle(null, false))}
    ${srow('Screen-share shield', 'While you share your screen, hide previews and other workspaces.', toggle(null, true))}
    ${srow('Tracker blocking <span class="tag">Later</span>', 'Blocks third-party trackers. Can\'t remove sponsored posts. May break some sites.', toggle(null, false))}
    <h5>Permissions</h5>
    <table class="perm"><thead><tr><th></th><th>${icon('video', 14)}</th><th>${icon('mic', 14)}</th><th>${icon('monitor', 14)}</th><th>${icon('bell', 14)}</th><th>${icon('globe', 14)}</th></tr></thead><tbody>
    ${STATE.workspaces.flatMap(w => w.instances.map(i => ({ w, i }))).slice(0, 9).map(({ w, i }) => {
      const callish = ['whatsapp', 'messenger', 'meet', 'chat'].includes(i.type);
      return `<tr><td>${logo(i.type, 20)} ${instName(i)} <small>${w.name}</small></td>${[callish, callish, i.type === 'meet', true, false].map(on => `<td><button class="perm-p ${on ? 'on' : ''}" data-act="perm">${on ? 'Allowed' : 'Off'}</button></td>`).join('')}</tr>`;
    }).join('')}</tbody></table>
    <h5>Data</h5>
    <button class="btn danger-t" data-act="noop">Reset everything…</button>`],

  wellbeing: ['Wellbeing', 'coffee', () => `
    ${srow('Time insights', 'Track time per service. Counts only when the window is focused, the service is on screen and you are active.', `${toggle(null, true)}<button class="btn sm" data-act="insights">Open</button>`)}
    ${srow('Feed guard', 'Gentle check-in when you pass a daily budget on feed apps. Messaging is never limited.', toggle(null, true))}
    <h5>Daily budgets</h5>
    ${['facebook', 'instagram', 'linkedin'].map((t, k) => srow(`${logo(t, 20)} ${CATALOG[t].name}`, '', `<input class="num" type="number" value="${[30, 20, 30][k]}"> min/day`)).join('')}
    ${srow('Nudge after continuous scrolling for', '', '<select><option>10 min</option><option selected>15 min</option><option>30 min</option></select>')}`],

  appearance: ['Appearance', 'sun', () => `
    ${srow('Theme', 'Applies to Extrovert itself. Services keep their own themes.', `<div class="seg inline">${['light', 'dark'].map(t => `<button class="${STATE.theme === t ? 'on' : ''}" data-act="theme" data-k="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}<button data-act="theme" data-k="light">System</button></div>`)}
    ${srow('Language', 'Extrovert is translation-ready. More languages coming.', '<select><option>English</option><option disabled>বাংলা (coming soon)</option><option disabled>Español (coming soon)</option></select>')}
    ${srow('Sidebar', '', '<select><option>Icons only</option><option>Icons + labels</option></select>')}
    ${srow('Zen mode', 'Hide the sidebar.', '<kbd>⌘\\</kbd>')}`],

  shortcuts: ['Shortcuts', 'type', () => `<div class="keys">${[['⌘K', 'Command palette / open link'], ['⌘J', 'Next unread (all workspaces)'], ['⌘1–9', 'Switch service'], ['⌘⇧1–9', 'Switch workspace'], ['⌘F', 'Find in page'], ['⌘R', 'Reload service'], ['⌘[ / ⌘]', 'Back / forward'], ['⌘\\', 'Zen mode'], ['⌘⇧V', 'Saved replies'], ['⌘⇧L', 'Lock & blur'], ['⌥ + hover', 'Peek'], ['⌘ + / −', 'Zoom service'], ['⌘,', 'Settings']].map(([k, t]) => `<div><kbd>${k}</kbd><span>${t}</span><button class="linkish" data-act="noop">Change</button></div>`).join('')}</div>`],

  updates: ['Updates', 'download', () => `
    ${srow('Current version', 'Extrovert 1.1.0', '<button class="btn sm" data-act="check-update">Check for updates</button>')}
    ${srow('Update channel', 'Beta gets new features earlier.', `<div class="seg inline"><button class="${!STATE.betaChannel ? 'on' : ''}" data-act="channel" data-k="stable">Stable</button><button class="${STATE.betaChannel ? 'on' : ''}" data-act="channel" data-k="beta">Beta</button></div>`)}
    ${srow('Check automatically', 'At startup and every 6 hours.', toggle(null, true))}
    <div class="note">${icon('shield', 16)}<p>Updates come straight from GitHub Releases and are verified (checksum + code signature) before installing. The check sends no personal data.</p></div>
    <button class="btn" data-act="whats-new">What's new</button> <button class="btn" data-act="feedback">Send feedback</button>`],

  import: ['Import & export', 'upload', () => `
    ${srow('Import from Ferdium', 'Brings over your service list. You only log in again.', '<button class="btn sm" data-act="ferdium">Choose export file…</button>')}
    <div id="imp-res"></div>
    ${srow('Export configuration', 'Workspaces, services and settings as JSON. Never includes logins.', '<button class="btn sm" data-act="noop">Export…</button>')}
    ${srow('Import configuration', '', '<button class="btn sm" data-act="noop">Import…</button>')}`],

  about: ['About', 'compass', () => `<div class="about">${brand(64)}<h2>Extrovert</h2><p>All your communities. One space.</p><small>Version 1.1.0 · Electron 33</small>
    <div class="note">${icon('shield', 16)}<p>No analytics. No telemetry. No server. Your logins stay on this device, and services run exactly as their real websites.</p></div></div>`],
};

function settingsModal(section = setSection) {
  setSection = section;
  openModal('Settings', `<div class="settings">
    <nav>${Object.entries(SECTIONS).map(([k, [t, ic]]) => `<button class="${k === section ? 'on' : ''}" data-act="set-sec" data-k="${k}">${icon(ic, 16)} ${t}</button>`).join('')}</nav>
    <div class="set-body"><h4>${SECTIONS[section][0]}</h4>${SECTIONS[section][2]()}</div></div>`, { wide: true, cls: 'settings-modal' });
  const vip = $('#vip-in');
  if (vip) vip.onkeydown = (e) => { if (e.key === 'Enter' && vip.value.trim()) { VIPS.add(vip.value.trim()); settingsModal('notifications'); } };
}

const ferdiumResult = () => `<div class="imp-ok">${icon('check', 16)}<div><b>Found 8 services in your Ferdium export</b><small>6 matched the catalog (WhatsApp, Messenger, Gmail, LinkedIn, Instagram, Calendar) · 2 added as custom URLs (Telegram, Discord). Logins aren't imported: sign in once in each.</small></div></div>`;

/* ================= Actions (event delegation targets) ================= */
const ACTIONS = {
  noop: () => {},
  'close-modal': closeModal,
  'close-palette': (el, e) => { if (!e.target.closest('[data-stop]')) closePalette(); },
  'pal-run': (el) => runPal(+el.dataset.k),
  nc: () => $('#nc').classList.contains('open') ? $('#nc').classList.remove('open') : openNC(),
  'nc-tab': (el) => { ncTab = el.dataset.k; renderNC(); },
  'nc-ws': (el) => { ncWs = el.dataset.k; renderNC(); },
  'nc-snooze': (el) => $(`#so-${el.dataset.id}`).classList.toggle('show'),
  'do-snooze': (el) => { const n = STATE.notifications.find(x => x.id === +el.dataset.id); STATE.notifications = STATE.notifications.filter(x => x !== n); snooze(n); renderNC(); },
  'toggle-vip': (el) => { const n = el.dataset.name; VIPS.has(n) ? VIPS.delete(n) : VIPS.add(n); renderNC(); snack(VIPS.has(n) ? `${n} is now a VIP: their messages break through DND and digests on every platform.` : `${n} removed from VIPs.`, [], 3000); },
  'rm-vip': (el) => { VIPS.delete(el.dataset.name); settingsModal('notifications'); },
  'link-names': () => { STATE.personLinks['Sara'] = 'Sara Khan'; STATE.notifications.unshift({ id: nextNotifId++, ws: 'work', inst: 'w-li', sender: 'Sara', text: 'Endorsed you for Product Design', ago: 'now' }); renderNC(); snack('Linked "Sara" (LinkedIn) with "Sara Khan" (Messenger). They now show as one person.'); },
  'deliver-digest': deliverDigest,
  'toggle-dnd': () => { STATE.dnd = !STATE.dnd; renderSidebar(); if ($('#nc').classList.contains('open')) renderNC(); snack(STATE.dnd ? 'Do Not Disturb on. Badges still update and VIPs still get through.' : 'Do Not Disturb off.', [], 2500); },
  'recap-catchup': () => { closeModal(); nextUnread(); },
  'close-find': () => toggleFind(false),
  unlock,
  'end-call': endCall,
  'return-call': () => openInst('personal', STATE.call.inst),
  'fg-continue': () => { $('#view-overlay').innerHTML = ''; snack('OK. Feed guard will check in again in 10 minutes.'); },
  'fg-break': () => { $('#view-overlay').innerHTML = ''; openInst('personal', 'p-wa'); snack('Break started. Facebook will be right where you left it.'); },
  insights: () => showInsights(),
  'ins-tab': (el) => showInsights(el.dataset.k),
  'mem-pressure': memoryPressure,
  'tm-sleep': (el) => { findInst(el.dataset.id).i.state = 'sleeping'; renderAll(); showTaskManager(); },
  'add-service': addServiceModal,
  'add-type': (el) => addInstance(el.dataset.type),
  'add-custom': () => { const v = $('#cu-in').value.trim() || 'web.telegram.org'; const host = v.replace(/^https?:\/\//, '').split('/')[0]; const nm = host.split('.').filter(p => !['www', 'web', 'app', 'com', 'org', 'net', 'io'].includes(p))[0] || 'Website'; addInstance('custom', { label: nm[0].toUpperCase() + nm.slice(1), url: host }); },
  'add-account': () => { closeModal(); $('#popover').innerHTML = ''; addAccountModal(); },
  'google-signin': googleSignIn,
  'ob-next': () => onboarding(obStep + 1),
  'ob-back': () => onboarding(obStep - 1),
  'ob-done': () => { $('#onboarding-root').innerHTML = ''; renderDock(); snack('Welcome to Extrovert 👋'); },
  'ob-ferdium': () => { $('#ob-imp').innerHTML = ferdiumResult(); },
  ferdium: () => { $('#imp-res').innerHTML = ferdiumResult(); },
  downloads: (el) => downloadsPopover(el),
  'tray-open': () => { $('#popover').innerHTML = ''; },
  settings: (el, e, section) => settingsModal(section || el?.dataset.section || 'account'),
  'set-sec': (el) => settingsModal(el.dataset.k),
  theme: (el) => { STATE.theme = el.dataset.k; renderAll(); settingsModal('appearance'); },
  channel: (el) => { STATE.betaChannel = el.dataset.k === 'beta'; settingsModal('updates'); },
  'ws-color': (el) => { ws(el.dataset.wsId).color = el.dataset.c; renderAll(); settingsModal('account'); },
  perm: (el) => { el.classList.toggle('on'); el.textContent = el.classList.contains('on') ? 'Allowed' : 'Off'; },
  'check-update': () => { closeModal(); snack('Checking GitHub Releases…', [], 1200); setTimeout(updateReady, 1300); },
  'whats-new': whatsNew,
  feedback: feedbackModal,
  'feedback-send': () => { closeModal(); snack('Opened a pre-filled GitHub issue in your browser. Nothing was sent automatically.'); },
  'resume-ws': () => { ws().suspended = false; renderAll(); snack(`${ws().name} resumed. Badges are live again.`); },
  'sign-in-again': () => { findInst(ws().active).i.state = undefined; renderAll(); snack('Signed in. Notifications resumed.'); },
  wake: () => setState('loading'),
  'state-retry': () => setState('loading'),
  'stop-share': stopShare,
  'ctx-reload': (el) => { $('#ctx').classList.remove('show'); const { w, i } = findInst(el.dataset.id); i.state = 'loading'; if (ws().active !== i.id || STATE.activeWs !== w.id) openInst(w.id, i.id); renderAll(); setTimeout(() => { i.state = undefined; renderAll(); if ($('.tm')) showTaskManager(); }, 1300); },
  'ctx-sleep': (el) => { $('#ctx').classList.remove('show'); findInst(el.dataset.id).i.state = 'sleeping'; renderAll(); },
  'ctx-mute': (el) => { $('#ctx').classList.remove('show'); const { i } = findInst(el.dataset.id); i.muted = !i.muted; renderAll(); snack(i.muted ? `${instName(i)} muted. Its badge no longer counts toward totals.` : `${instName(i)} unmuted.`); },
  'ctx-pin': (el) => { $('#ctx').classList.remove('show'); const { w, i } = findInst(el.dataset.id); STATE.pins.push({ ws: w.id, inst: i.id, title: `${instName(i)} · saved page`, url: CATALOG[i.type].url }); snack('Page pinned. Find it in ⌘K or by right-clicking the icon.'); },
  'ctx-zoom': (el) => { const { i } = findInst(el.dataset.id); i.zoom = Math.min(150, Math.max(70, (i.zoom || 100) + +el.dataset.d)); renderView(); openCtx(el.dataset.id, parseInt($('#ctx').style.left), parseInt($('#ctx').style.top)); },
  'ctx-logout': (el) => { $('#ctx').classList.remove('show'); findInst(el.dataset.id).i.state = 'signedout'; renderAll(); snack('Logged out and cleared this service\'s data. Other services were not affected.'); },
  tour: () => document.body.classList.toggle('tour-open'),
  acct: () => ($('.acct-pop') ? ($('#popover').innerHTML = '') : acctPopover()),
  'acct-switch': (el) => { $('#popover').innerHTML = ''; switchWorkspace(el.dataset.id); },
};

/* Settings toggles bound to STATE */
document.addEventListener('change', (e) => {
  const key = e.target.dataset.set;
  if (!key) return;
  STATE[key] = e.target.checked;
  if (key === 'digest' && !STATE.digest && STATE.digestQueue.length) deliverDigest();
  renderSidebar();
});

/* ================= Feature tour ================= */
const TOUR = [
  ['Getting started', [
    ['First launch (no accounts yet)', 'FR-W01', onboarding],
    ['Add a service (catalog or URL)', 'FR-S02', addServiceModal],
    ['Add another Google account', 'FR-W03', addAccountModal],
    ['Import from Ferdium', 'FR-X27', () => settingsModal('import')],
  ]],
  ['Workspaces', [
    ['Account menu (switch / add)', 'FR-W04', acctPopover, '⌘⇧1–9'],
    ['Multiple accounts of one app', 'FR-S03', () => { switchWorkspace('personal'); snack('Personal has two WhatsApp accounts: grouped together, tagged 1 and B (Business).', [], 4000); }],
    ['Paused workspace (Side project)', 'FR-W10', () => switchWorkspace('side')],
    ['Toggle "after work hours"', 'FR-A11', () => { STATE.afterHours = !STATE.afterHours; renderSidebar(); snack(STATE.afterHours ? 'Outside work hours: Work is muted (moon icon). VIPs still get through.' : 'Work hours: Work is live again.'); }],
  ]],
  ['Notifications', [
    ['Simulate incoming message', 'FR-A01/A05', simulateIncoming],
    ['Simulate VIP message', 'FR-X04', simulateVip],
    ['Toggle Do Not Disturb', 'FR-A10', () => ACTIONS['toggle-dnd']()],
    ['Toggle digest mode', 'FR-X05', () => { STATE.digest = !STATE.digest; renderSidebar(); snack(STATE.digest ? 'Digest on. New non-VIP alerts are held. Try "Simulate incoming".' : 'Digest off.', [], 2500); if (!STATE.digest) deliverDigest(); }],
    ['Deliver digest now', 'FR-X05', deliverDigest],
    ['Notification center', 'FR-A07', openNC],
    ['People view', 'FR-X07', () => { ncTab = 'people'; openNC(); }],
    ['Next unread everywhere', 'FR-X01', nextUnread, '⌘J'],
    ['Wake from sleep → recap', 'FR-X06/X17', wakeFromSleep],
  ]],
  ['Flow', [
    ['Command palette (paste a link)', 'FR-N06/X21', () => openPalette(), '⌘K'],
    ['Peek: hold ⌥ and hover an icon', 'FR-X08', () => snack('Hold the Alt/Option key and hover any service icon in the sidebar.', [], 3500), '⌥'],
    ['Start a call → call bubble', 'FR-X09', startCall],
    ['Pins: right-click a service', 'FR-X22', () => { const el = $('.svc'); const r = el.getBoundingClientRect(); openCtx(el.dataset.inst, r.right + 8, r.top); }],
    ['Saved replies', 'FR-X23', openReplies, '⌘⇧V'],
    ['Find in page', 'FR-N04', () => toggleFind(true), '⌘F'],
    ['Zen mode', 'FR-X24', toggleZen, '⌘\\'],
    ['Tray / menu-bar mini view', 'FR-X25', trayPopover],
    ['Downloads', 'FR-X26', () => downloadsPopover($('[data-act="downloads"]'))],
  ]],
  ['Privacy', [
    ['Start screen share → shield', 'FR-X10/X11', startShare],
    ['Privacy blur & lock', 'FR-X12', lockApp, '⌘⇧L'],
    ['Login watchdog (session expires)', 'FR-X02', sessionExpired],
    ['Permissions dashboard', 'FR-X28', () => settingsModal('privacy')],
  ]],
  ['Wellbeing', [
    ['Time insights', 'FR-X14', () => showInsights()],
    ['Feed guard check-in', 'FR-X15', feedGuard],
  ]],
  ['Performance', [
    ['Task manager', 'FR-X19', showTaskManager],
    ['Smart hibernation (low memory)', 'FR-X18', memoryPressure],
    ['Service: loading', 'FR-S08', () => setState('loading')],
    ['Service: offline', 'FR-S08', () => setState('offline')],
    ['Service: crashed', 'FR-S08', () => setState('crashed')],
  ]],
  ['Product', [
    ['Update ready (GitHub Releases)', 'FR-L02', updateReady],
    ["What's new + feedback", 'FR-X31', whatsNew],
    ['Badge health (Settings → Services)', 'FR-A08', () => { switchWorkspace('personal'); settingsModal('services'); }],
    ['Settings', 'FR-P01', () => settingsModal('account'), '⌘,'],
    ['Dark mode', 'FR-P02', () => { STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark'; renderAll(); }],
  ]],
];

function renderTour() {
  $('#tour').innerHTML = `<div class="tour-h"><div>${brand(26)}<b>Feature tour</b></div><button class="icon-btn" data-act="tour" aria-label="Close tour">${icon('x', 16)}</button></div>
    <p class="tour-sub">Visual prototype. Click any item to see the feature. Service screens are mocks; the real app loads the actual websites.</p>
    ${TOUR.map(([g, items], gi) => `<div class="tour-g"><h6>${g}</h6>${items.map(([t, fr, , key], k) => `<button class="tour-i" data-tour="${gi}:${k}"><span>${t}</span>${key ? `<kbd>${key}</kbd>` : ''}<em>${fr}</em></button>`).join('')}</div>`).join('')}`;
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tour]');
  if (!t) return;
  const [g, k] = t.dataset.tour.split(':').map(Number);
  TOUR[g][1][k][2]();
});

/* ================= Boot ================= */
renderTour();
renderAll();
makeDraggable($('#call-bubble'));
tick(); setInterval(tick, 1000);
$('#tray-btn').addEventListener('click', (e) => { e.stopPropagation(); $('#popover').innerHTML ? ($('#popover').innerHTML = '') : trayPopover(); });
