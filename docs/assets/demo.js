/*
 * A working replica of the Extrovert window, for the website. Everything is simulated in the page:
 * the people and messages are made up, and nothing is sent anywhere. It mirrors the app's real
 * behaviour: badges, account menu, ⌘K palette, ⌘J next unread, ⌥ + hover peek, zen and lock.
 * Keep it in step with the app (see .claude/skills/extrovert-docs-sync).
 */
(() => {
  const root = document.getElementById('demo');
  if (!root) return;
  const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  /** 'Mod+Shift+L' → ⌘⇧L on macOS, Ctrl+Shift+L elsewhere (the app's own format). */
  const keys = (k) => (MAC ? k.replace('Mod+', '⌘').replace('Shift+', '⇧').replace('Alt+', '⌥') : k.replace('Mod', 'Ctrl'));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ic = (id, cls = '') => `<svg class="ic ${cls}"><use href="#${id}"/></svg>`;

  // ------------------------------------------------------------------ data
  const BRANDS = {
    facebook: ['Facebook', '#1877F2'], messenger: ['Messenger', '#A033FF'], whatsapp: ['WhatsApp', '#25D366'],
    instagram: ['Instagram', '#DD2A7B'], linkedin: ['LinkedIn', '#0A66C2'], gmail: ['Gmail', '#EA4335'],
    calendar: ['Calendar', '#4285F4'], telegram: ['Telegram', '#29B6F6'], slack: ['Slack', '#E01E5A'],
  };
  const PEOPLE = { Rahim: '#F97316', Nadia: '#EC4899', Sara: '#0EA5E9', Tanvir: '#10B981', Farhan: '#8B5CF6', Mehjabin: '#EAB308', Arif: '#EF4444', Lamia: '#14B8A6', Zayan: '#6366F1' };
  const WORKSPACES = [
    { id: 'personal', name: 'Personal', email: 'nadia.rahman@gmail.com', color: '#4F46E5', services: [
      { id: 'fb', type: 'facebook', unread: 2 },
      { id: 'ms', type: 'messenger', unread: 1 },
      { id: 'wa', type: 'whatsapp', unread: 3, tag: '1', tagColor: '#64748B' },
      { id: 'wab', type: 'whatsapp', unread: 1, tag: 'B', tagColor: '#F59E0B', label: 'WhatsApp · Business' },
      { id: 'ig', type: 'instagram', unread: 0 },
      { id: 'gm', type: 'gmail', unread: 4 },
      { id: 'tg', type: 'telegram', unread: 0 },
    ] },
    { id: 'work', name: 'Work', email: 'nadia@studiofolk.co', color: '#0EA5E9', services: [
      { id: 'gm2', type: 'gmail', unread: 5 },
      { id: 'cal', type: 'calendar', unread: 0 },
      { id: 'li', type: 'linkedin', unread: 2 },
      { id: 'sl', type: 'slack', unread: 3 },
    ] },
  ];
  const INCOMING = [
    ['wa', 'Rahim', 'Are we still on for tonight? 🍕'], ['ig', 'Lamia', 'Sent you a reel'], ['sl', 'Farhan', 'Deploy is green, merging now'],
    ['li', 'Sara', 'Thanks for the intro! Free on Monday?'], ['ms', 'Zayan', 'lol did you see this'], ['gm2', 'Mehjabin', 'Contract v3 attached'],
    ['tg', 'Tanvir', 'Photos from the trip 📷'], ['wab', 'Arif', 'Is the blue one still available?'],
  ];

  const state = { ws: 'personal', active: { personal: 'wa', work: 'gm2' }, zen: false, locked: false, menu: null, palette: false, peek: null, notes: [], history: [] };
  const wsOf = (id) => WORKSPACES.find((w) => w.id === id);
  const find = (id) => { for (const w of WORKSPACES) { const s = w.services.find((x) => x.id === id); if (s) return { w, s }; } return null; };
  const nameOf = (s) => s.label ?? BRANDS[s.type][0];
  const unreadOf = (w) => w.services.reduce((n, s) => n + s.unread, 0);
  const av = (name, size = 36) => `<span class="m-av" style="--c:${PEOPLE[name] ?? '#64748B'};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px">${name[0]}</span>`;
  const tile = (s, size = 30) => `<span class="svc-tile" style="--brand:${BRANDS[s.type][1]};width:${size}px;height:${size}px">${ic('b-' + s.type)}</span>`;

  // ------------------------------------------------------------------ the services (simulated pages)
  const chats = (list, unread) => list.map(([n, msg, t], k) => `<div class="m-row ${k === 0 ? 'on' : ''}">${av(n, 40)}<div><b>${n}</b><small>${esc(msg)}</small></div><em>${t}${k === 0 && unread ? `<i>${unread}</i>` : ''}</em></div>`).join('');
  const bubbles = (list) => list.map(([me, text, t]) => `<div class="m-b ${me ? 'me' : ''}">${esc(text)}<small>${t}</small></div>`).join('');
  const PAGES = {
    whatsapp: (s) => `<div class="m wa"><aside><header><b>Chats</b>${ic('b-pencil')}</header><div class="m-search">${ic('i-search')} Search or start a new chat</div>
      ${chats(s.id === 'wab' ? [['Arif', 'Is the blue one still available?', '10:42'], ['Lamia', 'Order #1043 delivered ✓', '09:15'], ['Zayan', 'Price for 3 pieces?', 'Yesterday']] : [['Rahim', 'Are we still on for tonight? 🍕', '21:04'], ['Family 🏡', 'Ammu: Dinner at 9', '20:30'], ['Sara', 'Voice message (0:42)', '18:12'], ['Tanvir', 'Photo', 'Yesterday']], s.unread)}</aside>
      <section><header>${av(s.id === 'wab' ? 'Arif' : 'Rahim', 34)}<div><b>${s.id === 'wab' ? 'Arif' : 'Rahim'}</b><small>online</small></div>${ic('b-video')}${ic('b-phone')}</header>
      <div class="m-msgs">${bubbles(s.id === 'wab' ? [[0, 'Hi! Is the blue one still available?', '10:40'], [1, 'Yes, in M and L 🙂', '10:41'], [0, 'Great, I\'ll take an M', '10:42']] : [[0, 'Movie tomorrow?', '20:51'], [1, 'Yes! Booking 9 pm', '20:58'], [0, 'Are we still on for tonight? 🍕', '21:04']])}</div>
      <footer>${ic('b-smile')}${ic('b-clip')}<span>Type a message</span>${ic('b-mic')}</footer></section></div>`,
    messenger: () => `<div class="m msn"><aside><header><b>Chats</b></header><div class="m-search">${ic('i-search')} Search Messenger</div>
      ${chats([['Zayan', 'lol did you see this', '2m'], ['Mehjabin', 'You: see you there!', '1h'], ['Arif', 'Sent a photo', '3h']], 0)}</aside>
      <section><header>${av('Zayan', 34)}<div><b>Zayan</b><small>Active now</small></div>${ic('b-phone')}${ic('b-video')}</header>
      <div class="m-msgs">${bubbles([[0, 'did you watch the match', '21:30'], [1, 'last 10 minutes were unreal', '21:31'], [0, 'lol did you see this', '21:33']])}</div><footer><span>Aa</span>${ic('b-smile')}</footer></section></div>`,
    instagram: () => `<div class="m ig"><div class="ig-stories">${Object.keys(PEOPLE).slice(0, 7).map((n) => `<div>${av(n, 54)}<small>${n.toLowerCase()}</small></div>`).join('')}</div>
      <article><header>${av('Lamia', 32)}<b>lamia.frames</b><small>· 2h</small></header><div class="ig-img"></div>
      <div class="ig-act">${ic('b-heart')}${ic('b-comment')}${ic('b-send')}<span></span>${ic('b-bookmark')}</div><b>1,284 likes</b><p><b>lamia.frames</b> Golden hour at Cox's Bazar 🌅</p></article></div>`,
    facebook: () => `<div class="m fb"><div class="fb-col"><div class="fb-card fb-post">${av('Nadia', 36)}<span>What's on your mind, Nadia?</span></div>
      <div class="fb-card"><header>${av('Tanvir', 38)}<div><b>Tanvir Hasan</b><small>3h · 🌐</small></div></header><p>Finally finished the Sajek trek. Worth every step ⛰️</p><div class="fb-img"></div>
      <div class="fb-act"><span>${ic('b-like')} Like</span><span>${ic('b-comment')} Comment</span><span>${ic('b-send')} Share</span></div></div></div></div>`,
    linkedin: () => `<div class="m li"><div class="li-col"><div class="li-card"><header>${av('Sara', 44)}<div><b>Sara Ahmed</b><small>Product Lead at Pathfinder · 1d</small></div></header>
      <p>We just shipped offline mode to 2M users. Huge thanks to the team who made it happen 🙌</p><div class="li-img"></div>
      <div class="fb-act"><span>${ic('b-like')} Like</span><span>${ic('b-comment')} Comment</span><span>${ic('b-repost')} Repost</span><span>${ic('b-send')} Send</span></div></div></div></div>`,
    gmail: (s) => `<div class="m gm"><aside><div class="gm-new">${ic('b-pencil')} Compose</div><div class="on">${ic('b-inbox')} Inbox <em>${s.unread || ''}</em></div><div>${ic('b-star')} Starred</div><div>${ic('b-send')} Sent</div></aside>
      <section><div class="m-search">${ic('i-search')} Search mail</div>${(s.id === 'gm2' ? [['Mehjabin', 'Contract v3', 'Attached the final version with your edits…'], ['Figma', 'Farhan invited you to "Q4 site"', 'Open the file to start editing'], ['Arif', 'Invoice #2291', 'Thanks for the quick turnaround…'], ['Calendar', 'Design review at 3 pm', 'Thursday · Google Meet'], ['Sara', 'Re: hiring plan', 'Looks good, one question about…'], ['GitHub', '[extrovert] Release v0.2.0', 'Assets: dmg, exe, AppImage']] : [['bKash', 'Payment received', 'Tk 1,250 from Rahim…'], ['Daraz', 'Your order has shipped', 'Track your package…'], ['Nadia', 'Trip photos', 'Uploaded them to Drive…'], ['Medium', 'Stories for you', 'Why offline-first apps win…'], ['Ammu', 'Recipe', 'Here is the biryani one…']]).map(([f, sub, sn], k) => `<div class="gm-row ${k < s.unread ? 'u' : ''}"><b>${f}</b><span><b>${sub}</b> — ${sn}</span><small>${['10:42', '09:15', '08:03', 'Yesterday', 'Oct 8', 'Oct 7'][k]}</small></div>`).join('')}</section></div>`,
    calendar: () => `<div class="m cal"><header><b>October 2026</b><span>Week</span></header><div class="cal-grid">${['Mon 12', 'Tue 13', 'Wed 14', 'Thu 15', 'Fri 16'].map((d, k) => `<div><small>${d}</small>${[[2, 2, 'Standup', '#4285F4'], [5, 3, 'Design review', '#8B5CF6'], [1, 2, 'Client call', '#0EA5E9'], [6, 2, 'Lunch with Sara', '#10B981'], [3, 4, 'Focus time', '#F59E0B']].filter((_, j) => (j + k) % 2 === 0).map(([top, h, t, c]) => `<i style="top:${top * 34 + 30}px;height:${h * 30}px;--c:${c}">${t}</i>`).join('')}</div>`).join('')}</div></div>`,
    telegram: () => `<div class="m tg"><aside><div class="m-search">${ic('i-search')} Search</div>${chats([['Tanvir', 'Photos from the trip 📷', '19:20'], ['Dev Dhaka', 'Farhan: meetup on Friday', '17:02'], ['Lamia', 'Sticker', 'Mon']], 0)}</aside>
      <section><header>${av('Tanvir', 34)}<div><b>Tanvir</b><small>last seen recently</small></div></header><div class="m-msgs">${bubbles([[0, 'Photos from the trip 📷', '19:20'], [1, 'These are amazing!', '19:22']])}</div><footer><span>Message</span>${ic('b-mic')}</footer></section></div>`,
    slack: () => `<div class="m sl"><aside><b>Studio Folk</b><div>${ic('b-hash')} general</div><div class="on">${ic('b-hash')} engineering</div><div>${ic('b-hash')} design</div><div>${ic('b-hash')} random</div></aside>
      <section><header><b># engineering</b></header><div class="sl-msgs">${[['Farhan', 'Deploy is green, merging now', '11:02'], ['Sara', 'Nice! Release notes are in the doc', '11:04'], ['Arif', 'QA passed on Windows and Linux ✅', '11:10']].map(([n, t, time]) => `<div>${av(n, 34)}<div><b>${n}</b> <small>${time}</small><p>${esc(t)}</p></div></div>`).join('')}</div><footer><span>Message #engineering</span></footer></section></div>`,
  };

  // ------------------------------------------------------------------ rendering
  const ws = () => wsOf(state.ws);
  const activeSvc = () => ws().services.find((s) => s.id === state.active[state.ws]);

  // A badge pops only when its number changes, like in the app.
  const seen = new Map();
  const badge = (id, n) => {
    const pop = seen.has(id) && seen.get(id) !== n;
    seen.set(id, n);
    return n ? `<span class="badge${pop ? ' pop' : ''}">${n}</span>` : '';
  };

  function sidebar() {
    const w = ws();
    const others = WORKSPACES.filter((x) => x !== w).reduce((n, x) => n + unreadOf(x), 0);
    const groups = [];
    for (const s of w.services) (groups.at(-1)?.[0].type === s.type ? groups.at(-1) : groups[groups.push([]) - 1]).push(s);
    const btn = (s, k) => `<button class="svc ${s.id === state.active[w.id] ? 'active' : ''}" data-svc="${s.id}" title="${esc(nameOf(s))} (${keys('Mod+' + (k + 1))})&#10;Hold ${MAC ? '⌥' : 'Alt'} to peek">
      ${tile(s, 34)}${badge(s.id, s.unread)}${s.tag ? `<span class="inst-tag" style="--t:${s.tagColor}">${s.tag}</span>` : ''}</button>`;
    let k = 0;
    return `<aside class="sidebar">
      <button class="acct-btn" data-act="menu" style="--c:${w.color}" title="${esc(w.name)} · ${esc(w.email)}&#10;Click to switch account">N${badge('others:' + w.id, others)}<span class="acct-chev">${ic('i-down')}</span></button>
      <div class="sb-sep"></div>
      <nav class="svc-list">${groups.map((g) => (g.length > 1 ? `<div class="svc-group">${g.map((s) => btn(s, k++)).join('')}</div>` : btn(g[0], k++))).join('')}
        <button class="sb-btn" data-act="tip" data-tip="Add any app or website">${ic('i-plus')}</button></nav>
      <div class="sb-bottom">
        <button class="sb-btn" data-act="history" title="Notifications">${ic('i-bell')}${state.history.length ? `<span class="badge grey">${state.history.length}</span>` : ''}</button>
        <button class="sb-btn" data-act="keys" title="Shortcuts & features (${keys('Mod+/')})">${ic('i-command')}</button>
        <button class="sb-btn" data-act="tip" data-tip="Private time insights">${ic('i-chart')}</button>
        <button class="sb-btn" data-act="tip" data-tip="Settings">${ic('i-gear')}</button>
      </div></aside>`;
  }

  function overlays() {
    const w = ws();
    let html = '';
    if (state.menu === 'account') {
      html += `<div class="click-away" data-act="close"></div><div class="popover acct-pop">
        <div class="acct-cur"><small>${esc(w.email)}</small><span class="av" style="--c:${w.color};width:60px;height:60px;font-size:26px">N</span><b>Hi, Nadia!</b></div>
        <div class="acct-list">${WORKSPACES.filter((x) => x !== w).map((x) => `<button class="acct-row" data-ws="${x.id}"><span class="av" style="--c:${x.color};width:34px;height:34px">N</span><span class="acct-txt"><b>${x.name}</b><small>${esc(x.email)}</small></span>${unreadOf(x) ? `<em class="badge inline">${unreadOf(x)}</em>` : ''}</button>`).join('')}
        <button class="acct-row" data-act="tip" data-tip="Each Google account gets its own workspace"><span class="acct-plus">${ic('i-plus')}</span><span class="acct-txt"><b>Add another account</b><small>Each Google account gets its own workspace</small></span></button></div>
        <div class="acct-foot"><small>Switch with ${keys('Mod+Shift+1')}–9</small></div></div>`;
    }
    if (state.menu === 'history') {
      html += `<div class="click-away" data-act="close"></div><div class="popover hist-pop"><div class="pop-h"><b>Notifications</b></div>${state.history.length ? state.history.slice().reverse().map((n) => `<button class="hist" data-open="${n.id}">${av(n.from, 30)}<span><b>${n.from}</b><small>${esc(n.text)}</small></span>${tile(find(n.id).s, 18)}</button>`).join('') : '<p class="empty">New messages from every app and account show up here.</p>'}</div>`;
    }
    if (state.menu === 'keys') {
      const list = [['Mod+K', 'Jump anywhere'], ['Mod+J', 'Next unread'], ['Mod+1', 'Switch service (1–9)'], ['Mod+Shift+1', 'Switch account (1–9)'], ['peek', 'Peek'], ['Mod+\\', 'Zen mode'], ['Mod+Shift+L', 'Lock & blur']];
      html += `<div class="click-away" data-act="close"></div><div class="popover keys-pop"><div class="pop-h"><b>Shortcuts</b></div>${list.map(([k, t]) => `<div class="krow"><kbd>${k === 'peek' ? (MAC ? '⌥ + hover' : 'Alt + hover') : keys(k)}</kbd><span>${t}</span></div>`).join('')}</div>`;
    }
    if (state.peek) {
      const f = find(state.peek.id);
      html += `<div class="peek" style="top:${state.peek.y}px"><div class="peek-h">${tile(f.s, 16)}<b>${esc(nameOf(f.s))}</b><span>${f.w.name}</span><small>Peek</small></div><div class="peek-view"><div class="peek-page">${PAGES[f.s.type](f.s)}</div></div></div>`;
    }
    if (state.locked) {
      html += `<div class="lock"><div class="lock-card"><span class="brand-mark big"></span><h2>Extrovert is locked</h2><p>Your apps keep running. Notifications stay private.</p>
        <div class="pin"><i class="on"></i><i class="on"></i><i class="on"></i><i></i></div><button class="btn primary" data-act="unlock">${MAC ? `${ic('b-touch')} Unlock with Touch ID` : 'Unlock'}</button></div></div>`;
    }
    return html;
  }

  // Notifications slide in once, when they arrive.
  const shown = new Set();
  function notesHtml() {
    const html = state.notes.map((n) => `<button class="note-card${shown.has(n.key) ? '' : ' in'}" data-open="${n.id}" data-note="${n.key}">${tile(find(n.id).s, 32)}<span><small>EXTROVERT · ${esc(nameOf(find(n.id).s))} · ${find(n.id).w.name}</small><b>${n.from}</b>${esc(n.text)}</span></button>`).join('');
    state.notes.forEach((n) => shown.add(n.key));
    return html;
  }

  let palQ = '';
  let palSel = 0;
  function paletteItems() {
    const q = palQ.trim().toLowerCase();
    const items = [];
    for (const w of WORKSPACES) for (const s of w.services) items.push({ g: 'Services', label: nameOf(s), sub: w.name, s, run: () => select(w.id, s.id) });
    items.push(
      { g: 'Actions', label: 'Next unread', key: 'Mod+J', run: nextUnread, icon: 'i-zap' },
      { g: 'Actions', label: state.zen ? 'Show the sidebar' : 'Zen mode', key: 'Mod+\\', run: toggleZen, icon: 'i-expand' },
      { g: 'Actions', label: 'Lock Extrovert', key: 'Mod+Shift+L', run: lock, icon: 'i-lock' },
    );
    return items.filter((i) => !q || `${i.label} ${i.sub ?? ''}`.toLowerCase().includes(q));
  }
  const paletteShell = () => `<div class="pal-backdrop" data-act="close"><div class="palette" role="dialog" aria-label="Command palette">
      <div class="pal-in">${ic('i-search')}<input id="pal-q" placeholder="Jump to an app, pin or action. Or paste a link" autocomplete="off"><kbd>esc</kbd></div>
      <div class="pal-list"></div>
      <div class="pal-foot"><span>↑↓ to move</span><span>↵ to open</span><span class="tip">Tip: paste an Instagram link to open it in Instagram</span></div></div></div>`;
  function paletteList() {
    const items = paletteItems();
    palSel = Math.min(palSel, Math.max(0, items.length - 1));
    let last = '';
    return items.map((it, k) => `${it.g !== last ? `<div class="pal-g">${(last = it.g)}</div>` : ''}<div class="pal-item ${k === palSel ? 'sel' : ''}" data-pal="${k}">${it.s ? tile(it.s, 22) : ic(it.icon)}<b>${esc(it.label)}</b>${it.sub ? `<span>${it.sub}</span>` : ''}${it.s?.unread ? `<em class="badge inline">${it.s.unread}</em>` : it.key ? `<kbd>${keys(it.key)}</kbd>` : ''}</div>`).join('') || '<p class="empty">No match</p>';
  }

  // The window is built once; after that only the parts whose content changed are redrawn, so
  // nothing flickers, re-animates or loses hover when a message arrives.
  root.innerHTML = `<div class="titlebar"><i></i><i></i><i></i><span data-r="title"></span></div>
    <div class="app-row"><div data-r="side"></div><main class="main" data-r="main"></main></div>
    <div data-r="pop"></div><div data-r="pal"></div><div class="notes" data-r="notes"></div><div data-r="snack"></div>`;
  const region = (name) => root.querySelector(`[data-r="${name}"]`);
  const drawn = new WeakMap();
  function patch(el, html) {
    const key = html.replace(/ (pop|in)(?=")/g, ''); // a finished animation is not a change
    if (drawn.get(el) === key) return;
    drawn.set(el, key);
    el.innerHTML = html;
  }

  function render() {
    const s = activeSvc();
    patch(region('title'), `${esc(nameOf(s))} · ${ws().name}`);
    root.querySelector('.app-row').classList.toggle('blurred', state.locked);
    patch(region('side'), state.zen ? '' : sidebar());
    patch(region('main'), PAGES[s.type](s));
    patch(region('pop'), overlays());
    patch(region('notes'), notesHtml());
    patch(region('snack'), state.snack ? `<div class="snack">${esc(state.snack)}</div>` : '');
    // The palette keeps its box (and the text you typed) open; only its results update.
    const pal = region('pal');
    if (!state.palette) return void (pal.firstChild && (pal.innerHTML = ''));
    if (!pal.firstChild) {
      pal.innerHTML = paletteShell();
      const input = pal.querySelector('#pal-q');
      input.value = palQ;
      input.focus();
    }
    patch(pal.querySelector('.pal-list'), paletteList());
  }

  // ------------------------------------------------------------------ behaviour
  const done = (task) => document.querySelector(`[data-task="${task}"]`)?.classList.add('done');
  let readTimer;
  function select(wsId, id) {
    state.ws = wsId;
    state.active[wsId] = id;
    state.menu = null;
    state.palette = false;
    clearTimeout(readTimer);
    // Opening a service reads it: its badge clears, like in the real app.
    readTimer = setTimeout(() => { const f = find(id); if (f && state.active[state.ws] === id && f.s.unread) { f.s.unread = 0; render(); } }, 900);
    render();
  }
  function nextUnread() {
    const order = [...WORKSPACES.filter((w) => w.id === state.ws), ...WORKSPACES.filter((w) => w.id !== state.ws)];
    for (const w of order) for (const s of w.services) if (s.unread && !(w.id === state.ws && s.id === state.active[w.id])) return select(w.id, s.id), done('next');
    snack('Inbox zero everywhere 🎉');
    done('next');
  }
  function toggleZen() { state.zen = !state.zen; state.palette = false; render(); done('zen'); }
  // Locked: previews stay private, like in the app.
  function lock() { state.locked = true; state.palette = false; state.menu = null; state.notes = []; render(); done('lock'); }
  let snackTimer;
  function snack(text) { state.snack = text; render(); clearTimeout(snackTimer); snackTimer = setTimeout(() => { state.snack = null; render(); }, 2200); }

  let noteKey = 0;
  function incoming() {
    if (state.locked || document.hidden || !visible) return;
    const choices = INCOMING.filter(([id]) => !(id === state.active[state.ws] && find(id).w.id === state.ws));
    const [id, from, text] = choices[Math.floor(Math.random() * choices.length)];
    find(id).s.unread++;
    const note = { id, from, text, key: ++noteKey };
    state.notes = [...state.notes.slice(-1), note];
    state.history = [...state.history.slice(-5), note];
    render();
    setTimeout(() => { state.notes = state.notes.filter((n) => n.key !== note.key); render(); }, 5200);
  }

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-svc],[data-act],[data-ws],[data-open],[data-pal]');
    if (!el) return;
    if (el.dataset.svc) { select(state.ws, el.dataset.svc); done('open'); return; }
    if (el.dataset.ws) { select(el.dataset.ws, state.active[el.dataset.ws]); done('account'); return; }
    if (el.dataset.open) { const f = find(el.dataset.open); state.notes = []; select(f.w.id, f.s.id); done('notify'); return; }
    if (el.dataset.pal) { paletteItems()[+el.dataset.pal]?.run(); return; }
    const act = el.dataset.act;
    if (act === 'close' && e.target === el) { state.menu = null; state.palette = false; render(); }
    if (act === 'menu' || act === 'history' || act === 'keys') { state.menu = state.menu === act ? null : act === 'menu' ? 'account' : act; render(); }
    if (act === 'unlock') { state.locked = false; render(); }
    if (act === 'tip') snack(`${el.dataset.tip}: in the app`);
  });
  root.addEventListener('input', (e) => { if (e.target.id === 'pal-q') { palQ = e.target.value; palSel = 0; render(); } });

  // Hold ⌥/Alt over a service to peek at it without switching.
  root.addEventListener('mousemove', (e) => {
    const el = e.target.closest('[data-svc]');
    const id = e.altKey && el && el.dataset.svc !== state.active[state.ws] ? el.dataset.svc : null;
    if (id === state.peek?.id) return;
    state.peek = id ? { id, y: el.getBoundingClientRect().top - root.getBoundingClientRect().top } : null;
    if (id) done('peek');
    render();
  });
  root.addEventListener('mouseleave', () => { if (state.peek) { state.peek = null; render(); } });

  // Keyboard shortcuts work while the demo is on screen, with the app's own keys.
  let visible = false;
  new IntersectionObserver(([entry]) => { visible = entry.intersectionRatio > 0.35; }, { threshold: [0, 0.35, 1] }).observe(root);
  document.addEventListener('keydown', (e) => {
    if (!visible) return;
    const mod = MAC ? e.metaKey : e.ctrlKey;
    if (state.palette) {
      const items = paletteItems();
      if (e.key === 'ArrowDown') { palSel = Math.min(items.length - 1, palSel + 1); render(); e.preventDefault(); return; }
      if (e.key === 'ArrowUp') { palSel = Math.max(0, palSel - 1); render(); e.preventDefault(); return; }
      if (e.key === 'Enter') { items[palSel]?.run(); e.preventDefault(); return; }
    }
    if (e.key === 'Escape') { state.palette = false; state.menu = null; render(); return; }
    if (!mod || state.locked) return;
    const k = e.key.toLowerCase();
    const digit = /^Digit([1-9])$/.exec(e.code)?.[1];
    if (k === 'k' && !e.shiftKey) { state.palette = !state.palette; palQ = ''; palSel = 0; state.menu = null; render(); done('palette'); }
    else if (k === 'j') nextUnread();
    else if (e.key === '\\') toggleZen();
    else if (k === 'l' && e.shiftKey) lock();
    else if (digit && e.shiftKey) { const w = WORKSPACES[+digit - 1]; if (w) { select(w.id, state.active[w.id]); done('account'); } }
    else if (digit) { const s = ws().services[+digit - 1]; if (s) { select(state.ws, s.id); done('open'); } }
    else return;
    e.preventDefault();
  });
  document.addEventListener('keyup', (e) => { if (e.key === 'Alt' && state.peek) { state.peek = null; render(); } });

  // "Try it" chips run their action too, for touch screens and anyone who prefers clicking.
  document.querySelectorAll('[data-task]').forEach((chip) => {
    if (chip.dataset.keys) chip.querySelector('kbd')?.replaceChildren(keys(chip.dataset.keys));
    chip.addEventListener('click', () => {
      const t = chip.dataset.task;
      if (t === 'open') select(state.ws, ws().services[2].id), done('open');
      if (t === 'next') nextUnread();
      if (t === 'palette') { state.palette = true; palQ = ''; render(); done('palette'); }
      if (t === 'account') { state.menu = 'account'; render(); }
      if (t === 'peek') snack(`Hold ${MAC ? '⌥ Option' : 'Alt'} and move over an app in the sidebar`);
      if (t === 'zen') toggleZen();
      if (t === 'lock') lock();
      if (t === 'notify') incoming();
    });
  });

  // Fit the 1120×740 window to the page width.
  const fit = () => root.style.setProperty('--s', Math.min(1, root.parentElement.clientWidth / 1120));
  new ResizeObserver(fit).observe(root.parentElement);
  fit();
  render();
  setTimeout(incoming, 2500);
  setInterval(incoming, 11000);
})();
