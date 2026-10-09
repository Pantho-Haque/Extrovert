/* Extrovert prototype: app shell (sidebar, views, overlays, shortcuts). */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ws = (id = STATE.activeWs) => STATE.workspaces.find(w => w.id === id);
const findInst = (instId) => {
  for (const w of STATE.workspaces) {
    const i = w.instances.find(x => x.id === instId);
    if (i) return { w, i };
  }
  return {};
};
const instName = (i) => i.label || CATALOG[i.type].name;
const wsUnread = (w) => w.instances.reduce((n, i) => n + (i.muted ? 0 : i.unread), 0);
const wsDot = (w) => w.instances.some(i => i.dot && !i.muted);
const totalUnread = () => STATE.workspaces.reduce((n, w) => n + wsUnread(w), 0);
const fmtBadge = (n) => (n > 99 ? '99+' : n);

function brand(size = 28) {
  return `<span class="brand" style="width:${size}px;height:${size}px"><svg viewBox="0 0 24 24" width="${size * 0.7}" height="${size * 0.7}"><circle cx="9" cy="12" r="5.4" fill="none" stroke="#fff" stroke-width="2.2"/><circle cx="15" cy="12" r="5.4" fill="none" stroke="#fff" stroke-width="2.2"/></svg></span>`;
}

const popped = new Set(); // ids whose badge should animate on next render

/* Same-type instances are kept together so multiple accounts of one app read as a group. */
function groupedInstances(w) {
  const groups = new Map();
  w.instances.forEach(i => { if (!groups.has(i.type)) groups.set(i.type, []); groups.get(i.type).push(i); });
  return [...groups.values()];
}
const orderedInstances = (w) => groupedInstances(w).flat();
const TAG_COLORS = ['#64748B', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

function accountButton(active) {
  const others = STATE.workspaces.filter(w => w.id !== active.id && !w.suspended).reduce((n, w) => n + wsUnread(w), 0);
  const cls = [popped.has('acct') && 'pop'].filter(Boolean).join(' ');
  return `<button class="acct-btn ${cls}" data-act="acct" style="--c:${active.color}" aria-haspopup="menu" aria-label="Account: ${active.name}. ${others} unread in other accounts"
      data-tip="${active.name}|${active.email}${others ? ` · ${others} unread in other accounts` : ''}|Click to switch account">
    <span class="ws-letter">${active.name[0]}</span>
    ${others && !STATE.sharing ? `<span class="badge">${fmtBadge(others)}</span>` : ''}
    <span class="acct-chev">${icon('down', 10)}</span>
  </button>`;
}

function svcButton(w, i, tag, k) {
  const idx = orderedInstances(w).indexOf(i);
  const cls = [i.id === w.active && 'active', i.state && `st-${i.state}`, w.suspended && 'st-sleeping', i.muted && 'muted', popped.has(i.id) && 'pop'].filter(Boolean).join(' ');
  const media = i.media ? `<span class="media-dot" title="Using ${i.media}">${icon(i.media === 'screen' ? 'monitor' : i.media, 9)}</span>` : '';
  const warn = i.state === 'signedout' ? `<span class="warn-dot">${icon('alert', 9)}</span>` : '';
  const badge = i.unread ? `<span class="badge">${fmtBadge(i.unread)}</span>` : i.dot ? '<span class="badge dot"></span>' : '';
  const tagEl = tag ? `<span class="inst-tag" style="--t:${TAG_COLORS[k % TAG_COLORS.length]}">${tag}</span>` : '';
  const status = i.state === 'signedout' ? 'Signed out' : i.state === 'sleeping' ? 'Sleeping' : i.unread ? i.unread + ' unread' : 'No new items';
  return `<button class="svc ${cls}" data-inst="${i.id}" aria-label="${instName(i)}, ${i.unread} unread" data-tip="${instName(i)}|${status}|${idx < 9 ? '⌘' + (idx + 1) : ''}">
    ${logo(i.type, 34)}${badge}${media}${warn}${tagEl}</button>`;
}

/* ---------- Sidebar ---------- */
function renderSidebar() {
  const active = ws();
  $('#sidebar').innerHTML = `
    <div class="traffic"><i></i><i></i><i></i></div>
    ${accountButton(active)}
    <div class="sb-sep"></div>
    <nav class="svc-list" aria-label="Services">
      ${groupedInstances(active).map(group => {
        const items = group.map((i, k) => svcButton(active, i, group.length > 1 ? (i.tag || String(k + 1)) : '', k)).join('');
        return group.length > 1 ? `<div class="svc-group" aria-label="${group.length} ${CATALOG[group[0].type].name} accounts">${items}</div>` : items;
      }).join('')}
      <button class="sb-btn" data-act="add-service" aria-label="Add service" data-tip="Add service|Catalog or custom URL|">${icon('plus', 18)}</button>
    </nav>
    <div class="sb-bottom">
      <button class="sb-btn ${STATE.dnd ? 'on-dnd' : ''}" data-act="nc" aria-label="Notification center" data-tip="Notifications|${STATE.dnd ? 'Do Not Disturb is on' : STATE.digest ? 'Digest mode on' : 'History, people, snoozed'}|">${icon(STATE.dnd ? 'moon' : 'bell', 18)}${STATE.digestQueue.length ? `<span class="badge grey">${STATE.digestQueue.length}</span>` : ''}</button>
      <button class="sb-btn" data-act="downloads" aria-label="Downloads" data-tip="Downloads||">${icon('download', 18)}</button>
      <button class="sb-btn" data-act="insights" aria-label="Time insights" data-tip="Time insights||">${icon('chart', 18)}</button>
      <button class="sb-btn" data-act="settings" aria-label="Settings" data-tip="Settings||⌘,">${icon('gear', 18)}</button>
    </div>`;
  popped.clear();
}

/* ---------- Main view ---------- */
function renderView() {
  const w = ws();
  const { i } = findInst(w.active);
  const view = $('#view');
  if (w.suspended) {
    view.innerHTML = stateCard('clock', `${w.name} is paused`, 'Inactive workspaces are paused to save memory. Badges show the last known count until you resume.', 'Resume workspace', 'resume-ws');
  } else if (i.state === 'signedout') {
    view.innerHTML = stateCard('alert', `You've been signed out of ${instName(i)}`, 'Extrovert noticed this service went to its login page, so you would have silently missed notifications. Sign in again to resume them.', 'Sign in again', 'sign-in-again', 'warn');
  } else if (i.state === 'sleeping') {
    view.innerHTML = stateCard('moon', `${instName(i)} is sleeping`, 'Smart hibernation put this feed to sleep to free memory. Messaging apps stay awake.', 'Wake up', 'wake');
  } else if (i.state === 'loading') {
    view.innerHTML = `<div class="skeleton"><div class="sk-top"></div><div class="sk-row"><div class="sk-col"></div><div class="sk-main">${lines(3, 'sk')}<div class="sk-block"></div>${lines(2, 'sk')}</div></div></div>`;
  } else if (i.state === 'offline') {
    view.innerHTML = stateCard('wifi', "You're offline", `${instName(i)} will reload automatically when the connection is back.`, 'Retry now', 'state-retry');
  } else if (i.state === 'crashed') {
    view.innerHTML = stateCard('zap', `${instName(i)} stopped responding`, 'Only this service was affected. Everything else is still running.', 'Reload service', 'state-retry', 'warn');
  } else {
    view.innerHTML = renderMock(i);
  }
  view.style.zoom = i.zoom ? i.zoom / 100 : '';
  const live = !w.suspended && !i.state;
  $('#mock-tag').textContent = live ? `Prototype mock · the real ${i.url || CATALOG[i.type].url} loads here, untouched` : '';
  $('#mock-tag').hidden = !live;
}

function stateCard(ic, title, text, btn, act, tone = '') {
  return `<div class="state"><div class="state-card ${tone}"><span class="state-ic">${icon(ic, 28)}</span><h2>${title}</h2><p>${text}</p><button class="btn primary" data-act="${act}">${btn}</button></div></div>`;
}

/* ---------- Desktop chrome: dock, menu bar ---------- */
function renderDock() {
  const n = totalUnread();
  $('#dock').innerHTML = `
    <span class="dock-app" style="background:linear-gradient(#60A5FA,#2563EB)"></span>
    <span class="dock-app" style="background:linear-gradient(#FDE68A,#F59E0B)"></span>
    <span class="dock-app" style="background:linear-gradient(#A7F3D0,#059669)"></span>
    <span class="dock-ext" data-tip="Extrovert|Total unread across all workspaces|">${brand(46)}${n ? `<span class="badge big">${fmtBadge(n)}</span>` : ''}<i class="run-dot"></i></span>`;
  $('#tray-btn').classList.toggle('has-unread', n > 0);
}

function renderAll() {
  renderSidebar();
  renderView();
  renderDock();
  $('#win').classList.toggle('zen', STATE.zen);
  document.body.dataset.theme = STATE.theme;
  if ($('#nc').classList.contains('open')) renderNC();
}

/* ---------- Switching ---------- */
let readTimer;
function switchService(instId) {
  const w = ws();
  w.active = instId;
  $('#view-overlay').innerHTML = '';
  renderAll();
  clearTimeout(readTimer);
  // Simulate the user reading the service: the page's own title count drops shortly after.
  readTimer = setTimeout(() => {
    const { i } = findInst(instId);
    if (i && w.active === instId && !i.state && !w.suspended && (i.unread || i.dot)) {
      i.unread = 0; i.dot = false; renderSidebar(); renderDock();
    }
  }, 1600);
  maybeCallBubble();
}

function switchWorkspace(wsId) {
  STATE.activeWs = wsId;
  switchService(ws().active);
}

function openInst(wsId, instId) {
  STATE.activeWs = wsId;
  switchService(instId);
}

/* ---------- Tooltip & Peek (hold Alt) ---------- */
let altDown = false;
function showTip(el) {
  const [title, sub, key] = el.dataset.tip.split('|');
  const tip = $('#tooltip');
  tip.innerHTML = `<b>${title}</b>${sub ? `<span>${sub}</span>` : ''}${key ? `<kbd>${key}</kbd>` : ''}`;
  const r = el.getBoundingClientRect();
  const left = el.closest('.dock') ? r.left : r.right + 10;
  const top = el.closest('.dock') ? r.top - 56 : r.top + r.height / 2 - 20;
  Object.assign(tip.style, { left: left + 'px', top: top + 'px' });
  tip.classList.add('show');
}

function showPeek(el) {
  const { w, i } = findInst(el.dataset.inst);
  if (!i) return;
  const peek = $('#peek');
  peek.innerHTML = `<div class="peek-h">${logo(i.type, 18)}<b>${instName(i)}</b><span>${w.name}</span><small>Live snapshot · release ⌥ to close</small></div><div class="peek-body"><div class="peek-scale">${i.state ? stateCard('alert', 'Signed out', '', 'Sign in', 'noop') : MOCKS[i.type](i)}</div></div>`;
  const r = el.getBoundingClientRect();
  Object.assign(peek.style, { left: r.right + 12 + 'px', top: Math.max(40, r.top - 80) + 'px' });
  peek.classList.add('show');
}

document.addEventListener('mouseover', (e) => {
  const el = e.target.closest('[data-tip]');
  $('#tooltip').classList.remove('show');
  if (!el) return $('#peek').classList.remove('show');
  if (altDown && el.dataset.inst) { showPeek(el); return; }
  showTip(el);
});
document.addEventListener('keyup', (e) => { if (e.key === 'Alt') { altDown = false; $('#peek').classList.remove('show'); } });

/* ---------- OS notifications (toasts outside the window) ---------- */
function osToast({ logoHtml, app, title, body, actions = [], onClick, ttl = 7000 }) {
  const el = document.createElement('div');
  el.className = 'os-toast';
  el.innerHTML = `<div class="ot-h">${brand(18)}<span>${app}</span><small>now</small></div>
    <div class="ot-b">${logoHtml || ''}<div><b>${title}</b><p>${body}</p></div></div>
    ${actions.length ? `<div class="ot-a">${actions.map((a, k) => `<button data-k="${k}">${a.label}</button>`).join('')}</div>` : ''}`;
  el.addEventListener('click', (e) => {
    const k = e.target.closest('[data-k]')?.dataset.k;
    if (k !== undefined) actions[k].run(); else onClick?.();
    el.remove();
  });
  $('#os-toasts').prepend(el);
  setTimeout(() => el.classList.add('out'), ttl);
  setTimeout(() => el.remove(), ttl + 400);
}

/* In-window snackbar (update ready, confirmations) */
function snack(html, actions = [], ttl = 5000) {
  const el = document.createElement('div');
  el.className = 'snack';
  el.innerHTML = `<span>${html}</span>${actions.map((a, k) => `<button data-k="${k}" class="${k === 0 ? 'primary' : ''}">${a.label}</button>`).join('')}`;
  el.addEventListener('click', (e) => {
    const k = e.target.closest('[data-k]')?.dataset.k;
    if (k !== undefined) { actions[k].run?.(); el.remove(); }
  });
  $('#snack-root').append(el);
  if (ttl) setTimeout(() => el.remove(), ttl);
}

/* ---------- Modal ---------- */
function openModal(title, body, { wide = false, cls = '' } = {}) {
  $('#modal-root').innerHTML = `<div class="backdrop" data-backdrop><div class="modal ${wide ? 'wide' : ''} ${cls}" role="dialog" aria-label="${title}">
    <div class="modal-h"><h3>${title}</h3><button class="icon-btn" data-act="close-modal" aria-label="Close">${icon('x', 18)}</button></div>
    <div class="modal-b">${body}</div></div></div>`;
}
const closeModal = () => { $('#modal-root').innerHTML = ''; };

/* ---------- Context menu on service icons ---------- */
function openCtx(instId, x, y) {
  const { w, i } = findInst(instId);
  const pins = STATE.pins.filter(p => p.inst === instId);
  const ctx = $('#ctx');
  ctx.innerHTML = `
    <div class="ctx-h">${logo(i.type, 18)}<b>${instName(i)}</b><span>${w.name}</span></div>
    ${pins.length ? `<div class="ctx-label">Pins</div>${pins.map(p => `<button data-act="noop">${icon('pin', 14)} ${p.title}</button>`).join('')}<hr>` : ''}
    <button data-act="ctx-reload" data-id="${instId}">${icon('refresh', 14)} Reload <kbd>⌘R</kbd></button>
    <button data-act="ctx-sleep" data-id="${instId}">${icon('moon', 14)} Sleep now</button>
    <button data-act="ctx-mute" data-id="${instId}">${icon('bell', 14)} ${i.muted ? 'Unmute notifications' : 'Mute notifications'}</button>
    <button data-act="ctx-pin" data-id="${instId}">${icon('pin', 14)} Pin current page</button>
    <div class="ctx-zoom">${icon('search', 14)} Zoom <button data-act="ctx-zoom" data-id="${instId}" data-d="-10">−</button><b>${i.zoom || 100}%</b><button data-act="ctx-zoom" data-id="${instId}" data-d="10">+</button></div>
    <hr>
    <button data-act="settings" data-section="services">${icon('gear', 14)} Service settings</button>
    <button class="danger" data-act="ctx-logout" data-id="${instId}">${icon('logout', 14)} Log out & clear data</button>`;
  Object.assign(ctx.style, { left: x + 'px', top: Math.min(y, innerHeight - 380) + 'px' });
  ctx.classList.add('show');
}

/* ---------- Global input ---------- */
document.addEventListener('click', (e) => {
  if (!e.target.closest('#ctx')) $('#ctx').classList.remove('show');
  if (!e.target.closest('#popover, [data-act="downloads"], [data-act="acct"], #tray-btn')) $('#popover').innerHTML = '';
  if (e.target.matches('[data-backdrop]')) return closeModal();

  const act = e.target.closest('[data-act]');
  if (act && ACTIONS[act.dataset.act]) { e.preventDefault(); return ACTIONS[act.dataset.act](act, e); }
  const open = e.target.closest('[data-open]');
  if (open) { const [w, i] = open.dataset.open.split(':'); closeModal(); closePalette(); return openInst(w, i); }
  const wsBtn = e.target.closest('[data-ws]');
  if (wsBtn) return switchWorkspace(wsBtn.dataset.ws);
  const instBtn = e.target.closest('.svc[data-inst]');
  if (instBtn) return switchService(instBtn.dataset.inst);
});

document.addEventListener('contextmenu', (e) => {
  const instBtn = e.target.closest('.svc[data-inst]');
  if (!instBtn) return;
  e.preventDefault();
  openCtx(instBtn.dataset.inst, e.clientX, e.clientY);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Alt') altDown = true;
  const mod = e.metaKey || e.ctrlKey;
  if (e.key === 'Escape') return escapeAll();
  if (STATE.locked) return;
  if (!mod) return;
  const k = e.key.toLowerCase();
  const digit = e.code.startsWith('Digit') ? +e.code.slice(5) : 0;
  const map = {
    k: () => openPalette(),
    j: () => nextUnread(),
    f: () => toggleFind(true),
    '\\': () => toggleZen(),
    ',': () => ACTIONS.settings(),
  };
  if (e.shiftKey && k === 'l') { e.preventDefault(); return lockApp(); }
  if (e.shiftKey && k === 'v') { e.preventDefault(); return openReplies(); }
  if (e.shiftKey && digit) { const w = STATE.workspaces[digit - 1]; if (w) { e.preventDefault(); switchWorkspace(w.id); } return; }
  if (digit) { const i = orderedInstances(ws())[digit - 1]; if (i) { e.preventDefault(); switchService(i.id); } return; }
  if (map[k]) { e.preventDefault(); map[k](); }
});

function escapeAll() {
  closeModal(); closePalette(); toggleFind(false);
  $('#ctx').classList.remove('show'); $('#popover').innerHTML = '';
  $('#nc').classList.remove('open');
}

/* ---------- Clock ---------- */
function tick() {
  $('#clock').textContent = new Date().toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  const t = $('[data-timer]');
  if (t && STATE.call) t.textContent = fmtTimer(Date.now() - STATE.call.start);
  const bt = $('#call-bubble [data-btimer]');
  if (bt && STATE.call) bt.textContent = fmtTimer(Date.now() - STATE.call.start);
}
const fmtTimer = (ms) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
