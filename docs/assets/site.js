/* Page behaviour: the visitor's system (download button, install card, shortcut column) and the feature panel. */
(() => {
  const ua = navigator.userAgent;
  const os = /Mac|iPhone|iPad/.test(ua) ? 'mac' : /Win/.test(ua) ? 'win' : /Linux|X11|CrOS/.test(ua) ? 'linux' : null;
  const name = { mac: 'macOS', win: 'Windows', linux: 'Linux' }[os];
  const icon = { mac: 'b-apple', win: 'b-windows', linux: 'b-linux' }[os];

  if (os) {
    document.querySelectorAll('.download').forEach((a) => {
      a.querySelector('.os-label').textContent = `Download for ${name}`;
      a.querySelector('.os-icon use').setAttribute('href', `#${icon}`);
    });
    if (os !== 'mac') document.querySelectorAll('kbd[data-pc]').forEach((k) => { k.textContent = k.dataset.pc; });
  }
  document.querySelectorAll('.peek-key').forEach((k) => { k.textContent = os === 'mac' ? '⌥ + hover' : 'Alt + hover'; });

  // "Only in Extrovert": every card opens to show a little simulated picture and more detail. The open
  // card takes the 2×2 spot; the one that was open shrinks back.
  const t = (type, size = 30) => `<span class="svc-tile" style="--brand:${BRAND[type]};width:${size}px;height:${size}px"><svg class="ic"><use href="#b-${type}"/></svg></span>`;
  const av = (name, color, size = 28) => `<span class="art-av" style="background:${color};width:${size}px;height:${size}px">${name[0]}</span>`;
  const badge = (n) => `<em class="art-badge">${n}</em>`;
  const note = (type, who, text, extra = '') => `<div class="art-note">${t(type, 30)}<div><small>${NAMES[type]} · Personal</small><b>${who}</b>${text}</div>${extra}</div>`;
  const NAMES = { whatsapp: 'WhatsApp', messenger: 'Messenger', linkedin: 'LinkedIn', instagram: 'Instagram' };
  const BRAND = { facebook: '#1877F2', messenger: '#A033FF', whatsapp: '#25D366', instagram: '#DD2A7B', linkedin: '#0A66C2', gmail: '#EA4335', meet: '#00897B', telegram: '#29B6F6' };
  const NOTE_TO = { whatsapp: 'WhatsApp', messenger: 'Messenger', instagram: 'Instagram', linkedin: 'LinkedIn', gmail: 'Gmail', facebook: 'Facebook' };
  const mod = os === 'mac' || !os ? '⌘' : 'Ctrl+';
  /* Each open card holds a small working demo of its feature ("Try it"). ART draws it, PLAY wires it up. */
  const ART = {
    'switch-accounts-in-one-click': () => `<div class="art-card">${[['Personal', '#4F46E5', 3], ['Work', '#0EA5E9', 12], ['Side project', '#EC4899', 2]].map(([n, c, u], i) => `<button class="art-row ${i ? '' : 'on'}" data-u="${u}">${av('N', c)}<b>${n}</b>${i ? badge(u) : ''}</button>`).join('')}</div><small class="art-try">Pick an account</small>`,
    'next-unread': () => `<div class="art-col">${[['whatsapp', 3], ['instagram', 0], ['gmail', 4], ['linkedin', 2]].map(([ty, n]) => `<span class="art-tile" data-n="${n}">${t(ty, 40)}${n ? badge(n) : ''}</span>`).join('')}</div><button class="art-btn" data-act="next">${mod}J · Next unread</button>`,
    'people-view': () => `<div class="art-card">${[['Rahim', '#F97316', ['whatsapp', 'whatsapp', 'linkedin'], 'Are we still on for tonight? · Sent the slides'], ['Sara', '#0EA5E9', ['instagram'], 'Loved your post!'], ['Tanvir', '#10B981', ['messenger', 'gmail'], 'Trip photos · Invoice attached']].map(([n, c, ts, msg]) => `<button class="art-row art-person">${av(n, c)}<b>${n}</b><span class="art-mini">${ts.map((ty) => t(ty, 20)).join('')}</span><small>${msg}</small></button>`).join('')}</div><small class="art-try">Tap a person</small>`,
    'vips': () => `<div class="art-stack"><button class="art-pill" data-act="dnd" aria-pressed="false"><svg class="ic"><use href="#i-moon"/></svg> Do Not Disturb: off</button>${note('whatsapp', 'Ammu <i class="art-vip">★ VIP</i>', 'Call me when you are free')}<div class="art-quiet">${note('messenger', 'Group chat', '27 new messages')}</div><small class="art-try">Turn on Do Not Disturb</small></div>`,
    'snooze-to-the-exact-chat': () => `<div class="art-stack"><div class="art-snooze">${note('messenger', 'Zayan', 'Are you coming tomorrow?')}</div><div class="art-chips">${['15 min', '1 hour', 'Tonight', 'Tomorrow'].map((x) => `<button>${x}</button>`).join('')}</div><small class="art-try">Snooze it</small></div>`,
    'while-you-were-away-recap': () => `<div class="art-card"><small class="art-h">While you were away · 42 min</small>${[['Rahim', '#F97316', 'whatsapp'], ['Lamia', '#14B8A6', 'instagram'], ['Sara', '#0EA5E9', 'linkedin']].map(([n, c, ty]) => `<button class="art-row">${av(n, c, 24)}<b>${n}</b>${t(ty, 20)}</button>`).join('')}</div><small class="art-try">Tap someone to go there</small>`,
    'login-watchdog': () => `<div class="art-card art-warn"><span class="art-tile">${t('linkedin', 40)}<em class="art-alert">!</em></span><b class="art-state">You've been signed out of LinkedIn</b><button class="art-btn" data-act="signin">Sign in again</button></div>`,
    'peek': () => `<div class="art-peek"><div class="art-col">${['whatsapp', 'instagram', 'gmail'].map((ty, i) => `<button class="art-tile ${i === 1 ? 'next' : ''}" data-peek="${ty}">${t(ty, 36)}</button>`).join('')}</div><div class="art-snap"><small>${t('instagram', 14)} <span>Instagram</span> · Peek</small><i class="instagram"></i></div></div><small class="art-try">Hover the apps</small>`,
    'call-bubble': () => `<div class="art-callbox"><div class="art-call" title="Drag me">${av('Sara', '#0EA5E9', 42)}<b>Sara</b><small>12:48 · WhatsApp</small><button class="art-hang" aria-label="Hang up"><svg class="ic"><use href="#b-phone"/></svg></button></div></div><small class="art-try">Drag the call around</small>`,
    'camera-mic-and-screen-indicators': () => `<div class="art-row3">${[['meet', 'camera'], ['whatsapp', 'mic'], ['messenger', 'screen']].map(([ty, i]) => `<button class="art-tile on">${t(ty, 46)}<em class="art-live"><svg class="ic"><use href="#i-${i}"/></svg></em></button>`).join('')}</div><small class="art-try">Tap to start or stop</small>`,
    'screen-share-shield': () => `<div class="art-stack"><button class="art-pill red" data-act="share" aria-pressed="true"><svg class="ic"><use href="#i-screen"/></svg> Sharing your screen</button><div class="art-blur">${note('whatsapp', 'Rahim', 'Are we still on for tonight?')}</div><small class="art-try">Tap to stop sharing</small></div>`,
    'time-insights': () => `<div class="art-card"><div class="art-seg"><button class="on" data-range="0">Today</button><button data-range="1">This week</button></div>${['instagram', 'facebook', 'whatsapp', 'linkedin'].map((ty) => `<div class="art-bar">${t(ty, 20)}<span><i></i></span><small></small></div>`).join('')}</div>`,
    'feed-guard': () => `<div class="art-card art-center"><svg class="ic art-big"><use href="#i-coffee"/></svg><b class="art-state">Still want to scroll?</b><small>31 of your 30 minutes on Instagram today</small><div class="art-chips"><button data-act="continue">Continue</button><button class="on" data-act="break">Take a break</button></div></div>`,
  };
  const PLAY = {
    'switch-accounts-in-one-click': (el) => el.querySelectorAll('.art-row').forEach((r) => r.addEventListener('click', () => {
      el.querySelectorAll('.art-row').forEach((x) => x.classList.toggle('on', x === r));
      r.querySelector('.art-badge')?.remove(); // opening an account reads it
    })),
    'next-unread': (el) => {
      const tiles = [...el.querySelectorAll('.art-tile')];
      el.querySelector('[data-act=next]').addEventListener('click', (e) => {
        const next = tiles.find((x) => x.querySelector('.art-badge'));
        tiles.forEach((x) => x.classList.toggle('next', x === next));
        if (next) setTimeout(() => next.querySelector('.art-badge')?.remove(), 350);
        else { e.currentTarget.textContent = 'Inbox zero 🎉'; setTimeout(() => { el.innerHTML = ART['next-unread'](); PLAY['next-unread'](el); }, 1600); }
      });
    },
    'people-view': (el) => el.querySelectorAll('.art-person').forEach((r) => r.addEventListener('click', () => r.classList.toggle('open'))),
    'vips': (el) => el.querySelector('[data-act=dnd]').addEventListener('click', (e) => {
      const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
      e.currentTarget.setAttribute('aria-pressed', String(on));
      e.currentTarget.lastChild.textContent = ` Do Not Disturb: ${on ? 'on' : 'off'}`;
      el.querySelector('.art-quiet').classList.toggle('hidden', on); // only the VIP gets through
    }),
    'snooze-to-the-exact-chat': (el) => el.querySelectorAll('.art-chips button').forEach((b) => b.addEventListener('click', () => {
      const n = el.querySelector('.art-snooze');
      n.classList.add('away');
      el.querySelector('.art-try').textContent = `Snoozed until ${b.textContent.toLowerCase()}…`;
      setTimeout(() => { n.classList.remove('away'); el.querySelector('.art-try').textContent = 'Back! Opens the exact chat'; }, 1800);
    })),
    'while-you-were-away-recap': (el) => el.querySelectorAll('.art-row').forEach((r) => r.addEventListener('click', () => {
      r.classList.add('read');
      el.querySelector('.art-try').textContent = `Opening ${r.querySelector('b').textContent}'s chat…`;
    })),
    'login-watchdog': (el) => el.querySelector('[data-act=signin]').addEventListener('click', (e) => {
      const done = el.querySelector('.art-warn').classList.toggle('ok');
      el.querySelector('.art-state').textContent = done ? 'Signed in. Badges are live again.' : "You've been signed out of LinkedIn";
      e.currentTarget.textContent = done ? 'Sign out (to test)' : 'Sign in again';
    }),
    'peek': (el) => el.querySelectorAll('[data-peek]').forEach((b) => {
      const show = () => {
        el.querySelectorAll('[data-peek]').forEach((x) => x.classList.toggle('next', x === b));
        el.querySelector('.art-snap i').className = b.dataset.peek;
        el.querySelector('.art-snap span').textContent = NOTE_TO[b.dataset.peek];
        el.querySelector('.art-snap .svc-tile').outerHTML = t(b.dataset.peek, 14);
      };
      b.addEventListener('mouseenter', show);
      b.addEventListener('click', show);
    }),
    'call-bubble': (el) => {
      const box = el.querySelector('.art-callbox');
      const call = el.querySelector('.art-call');
      let drag = null;
      call.addEventListener('pointerdown', (e) => { if (e.target.closest('.art-hang')) return; drag = { x: e.clientX - call.offsetLeft, y: e.clientY - call.offsetTop }; call.setPointerCapture(e.pointerId); });
      call.addEventListener('pointermove', (e) => {
        if (!drag) return;
        call.style.left = `${Math.max(0, Math.min(box.clientWidth - call.offsetWidth, e.clientX - drag.x))}px`;
        call.style.top = `${Math.max(0, Math.min(box.clientHeight - call.offsetHeight, e.clientY - drag.y))}px`;
      });
      call.addEventListener('pointerup', () => { drag = null; });
      el.querySelector('.art-hang').addEventListener('click', () => {
        call.classList.toggle('ended');
        call.querySelector('small').textContent = call.classList.contains('ended') ? 'Call ended · tap to call back' : '12:48 · WhatsApp';
      });
    },
    'camera-mic-and-screen-indicators': (el) => el.querySelectorAll('.art-tile').forEach((b) => b.addEventListener('click', () => b.classList.toggle('on'))),
    'screen-share-shield': (el) => el.querySelector('[data-act=share]').addEventListener('click', (e) => {
      const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
      e.currentTarget.setAttribute('aria-pressed', String(on));
      e.currentTarget.lastChild.textContent = on ? ' Sharing your screen' : ' Not sharing';
      e.currentTarget.classList.toggle('red', on);
      el.querySelector('.art-blur').classList.toggle('clear', !on);
      el.querySelector('.art-try').textContent = on ? 'Tap to stop sharing' : 'Previews are back. Tap to share again';
    }),
    'time-insights': (el) => {
      const DATA = [[[72, '48m'], [45, '31m'], [30, '20m'], [16, '11m']], [[62, '5h 10m'], [80, '6h 40m'], [48, '4h'], [26, '2h 10m']]];
      const show = (k) => {
        el.querySelectorAll('[data-range]').forEach((b) => b.classList.toggle('on', +b.dataset.range === k));
        el.querySelectorAll('.art-bar').forEach((bar, i) => { bar.querySelector('i').style.width = `${DATA[k][i][0]}%`; bar.querySelector('small').textContent = DATA[k][i][1]; });
      };
      el.querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => show(+b.dataset.range)));
      show(0);
    },
    'feed-guard': (el) => el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      el.querySelector('.art-state').textContent = b.dataset.act === 'break' ? 'Break started. Your feed will be right where you left it.' : "Okay. I'll ask again in 10 minutes.";
    })),
  };

  const cards = [...document.querySelectorAll('.grid .hl')];
  // The orbit: the open feature in the middle, the other 12 as chips on a slowly turning circle
  // around it, each linked to the middle, with messages flowing in. Tapping a chip swaps it with the
  // middle card. Narrow screens get a plain stack instead (CSS).
  const grid = document.querySelector('.grid');
  const wide = matchMedia('(min-width: 1100px)');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let center = 0;
  const ring = cards.map((_, i) => i).filter((i) => i !== center);
  const NS = 'http://www.w3.org/2000/svg';
  const lines = document.createElementNS(NS, 'svg');
  lines.setAttribute('class', 'orbit-lines');
  lines.setAttribute('aria-hidden', 'true');
  const links = ring.map(() => lines.appendChild(document.createElementNS(NS, 'line')));
  grid?.prepend(lines);
  let spin = 0, paused = false, holding = false, last = 0, nextPulse = 0, pulses = [];
  const spot = (slot) => {
    const W = grid.clientWidth, H = grid.clientHeight;
    const a = -Math.PI / 2 + (slot * 2 * Math.PI) / ring.length + spin;
    // A rounded square rather than an ellipse, so chips stay clear of the card's corners.
    const bulge = (v) => Math.sign(v) * Math.abs(v) ** 0.72;
    return [W / 2 + (W / 2 - 98) * bulge(Math.cos(a)), H / 2 + (H / 2 - 34) * bulge(Math.sin(a))];
  };
  /** Puts each chip (and its link) on the circle. */
  function position() {
    const W = grid.clientWidth, H = grid.clientHeight;
    ring.forEach((i, slot) => {
      const [x, y] = spot(slot);
      cards[i].style.left = `${x}px`;
      cards[i].style.top = `${y}px`;
      links[slot].setAttribute('x1', x); links[slot].setAttribute('y1', y);
      links[slot].setAttribute('x2', W / 2); links[slot].setAttribute('y2', H / 2);
    });
  }
  function frame(now) {
    const dt = Math.min(64, now - (last || now));
    last = now;
    if (grid.classList.contains('orbit')) {
      if (!paused && !holding && !still) spin += (dt * 2 * Math.PI) / 200000; // one turn in about 3 minutes
      const W = grid.clientWidth, H = grid.clientHeight;
      position();
      // A message travels from a feature into Extrovert every so often.
      if (!still && now > nextPulse) {
        const dot = lines.appendChild(document.createElementNS(NS, 'circle'));
        dot.setAttribute('r', '4');
        pulses.push({ dot, slot: Math.floor(Math.random() * ring.length), start: now });
        nextPulse = now + 650 + Math.random() * 900;
      }
      pulses = pulses.filter((p) => {
        const t = (now - p.start) / 1400;
        if (t >= 1) { p.dot.remove(); return false; }
        const [x, y] = spot(p.slot);
        const e = t * t * (3 - 2 * t);
        p.dot.setAttribute('cx', x + (W / 2 - x) * e);
        p.dot.setAttribute('cy', y + (H / 2 - y) * e);
        p.dot.setAttribute('opacity', String(Math.min(1, 4 * (1 - t))));
        return true;
      });
    }
    requestAnimationFrame(frame);
  }
  const mode = () => {
    grid?.classList.toggle('orbit', wide.matches);
    if (wide.matches) position();
    else cards.forEach((c) => { c.style.left = ''; c.style.top = ''; });
  };
  wide.addEventListener('change', mode);
  grid?.addEventListener('pointerenter', () => { paused = true; });
  grid?.addEventListener('pointerleave', () => { paused = false; });
  grid?.addEventListener('focusin', () => { paused = true; });
  grid?.addEventListener('focusout', () => { paused = false; });

  cards.forEach((card, i) => {
    const art = ART[card.dataset.feature];
    if (art) {
      card.insertAdjacentHTML('afterbegin', `<div class="hl-art">${art()}</div>`);
      PLAY[card.dataset.feature]?.(card.querySelector('.hl-art'));
    }
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    const open = () => {
      if (card.classList.contains('open')) return;
      const old = cards[center];
      const box = (el) => { const r = el.getBoundingClientRect(), g = grid.getBoundingClientRect(); return { left: r.left - g.left + r.width / 2, top: r.top - g.top + r.height / 2, width: r.width, height: r.height }; };
      const orbit = grid.classList.contains('orbit');
      const from = orbit && !still ? [box(card), box(old)] : null;
      ring[ring.indexOf(i)] = center;
      center = i;
      card.style.left = '';
      card.style.top = '';
      cards.forEach((c) => { c.classList.toggle('open', c === card); c.setAttribute('aria-expanded', String(c === card)); });
      if (orbit) position();
      if (from) {
        // Morph both cards inside the section (never over the page header): size and place glide,
        // the content fades back in once the card has settled. The ring holds still meanwhile.
        holding = true;
        const px = (b) => ({ left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` });
        const anims = [card, old].map((el, k) => {
          el.classList.add('morph');
          const to = box(el);
          return el.animate([px(from[k]), px(to)], { duration: 800, easing: 'cubic-bezier(.22, .8, .25, 1)' });
        });
        Promise.all(anims.map((a) => a.finished)).then(() => {
          card.classList.remove('morph'); old.classList.remove('morph');
          holding = false;
        });
      } else if (card.getBoundingClientRect().top < 70) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => { if (e.target === card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); } });
  });
  cards[center]?.classList.add('open');
  cards.forEach((c, i) => c.setAttribute('aria-expanded', String(i === center)));
  mode();
  requestAnimationFrame(frame);

  // Feature panel: groups on the left (like the app's Shortcuts & features), search across all.
  const nav = document.getElementById('feat-nav');
  const groups = [...document.querySelectorAll('.fgroup')];
  const empty = document.querySelector('.feat-empty');
  let current = groups[0]?.id;
  groups.forEach((g) => {
    const b = document.createElement('button');
    b.dataset.group = g.id;
    b.innerHTML = `<svg class="ic"><use href="#i-${g.dataset.icon}"/></svg>${g.querySelector('h3').textContent}<em>${g.querySelectorAll('li').length}</em>`;
    b.addEventListener('click', () => { current = g.id; search.value = ''; show(); });
    nav.append(b);
  });
  const search = document.getElementById('feat-q');
  function show() {
    const q = search.value.trim().toLowerCase();
    let any = false;
    for (const g of groups) {
      let hits = 0;
      g.querySelectorAll('li').forEach((li) => {
        const hit = !q || li.textContent.toLowerCase().includes(q);
        li.classList.toggle('hide', !hit);
        hits += hit;
      });
      const visible = q ? hits > 0 : g.id === current;
      g.classList.toggle('show', visible);
      any ||= visible;
    }
    nav.querySelectorAll('button').forEach((b) => b.classList.toggle('on', !q && b.dataset.group === current));
    empty.hidden = any;
  }
  search.addEventListener('input', show);
  show();

  // ------------------------------------------------------------------ Install: one tab per system
  const tabs = [...document.querySelectorAll('.inst-tabs [data-os]')];
  const pickOs = (id) => {
    tabs.forEach((t) => { t.setAttribute('aria-selected', String(t.dataset.os === id)); t.classList.toggle('on', t.dataset.os === id); });
    document.querySelectorAll('.inst-panel').forEach((p) => { p.hidden = p.dataset.os !== id; });
  };
  tabs.forEach((t) => t.addEventListener('click', () => pickOs(t.dataset.os)));
  pickOs(os ?? 'mac');
  document.querySelectorAll('.copy').forEach((b) => b.addEventListener('click', () => {
    navigator.clipboard?.writeText(b.dataset.copy).then(() => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1500); });
  }));

  // ------------------------------------------------------------------ Shortcuts: a live keyboard
  const kb = document.getElementById('kb');
  if (kb) {
    const binds = [...document.querySelectorAll('.kbind')];
    const now = document.querySelector('.kbd-now span');
    let plat = os === 'mac' || !os ? 'mac' : 'pc';
    // [id, mac label, pc label, width]. "mod" is ⌘ on macOS and Ctrl elsewhere, as in the app.
    const ROWS = [
      [['esc', 'esc', 'Esc', 1.4], ...'1234567890'.split('').map((d) => [d, d, d]), ['-', '–', '-'], ['=', '=', '='], ['delete', 'delete', 'Backspace', 1.6]],
      [['tab', 'tab', 'Tab', 1.5], ...'qwertyuiop'.split('').map((k) => [k, k.toUpperCase(), k.toUpperCase()]), ['[', '[', '['], [']', ']', ']'], ['\\', '\\', '\\', 1.5]],
      [['caps', 'caps lock', 'Caps', 1.8], ...'asdfghjkl'.split('').map((k) => [k, k.toUpperCase(), k.toUpperCase()]), [';', ';', ';'], ["'", "'", "'"], ['return', 'return', 'Enter', 2.2]],
      [['shift', 'shift', 'Shift', 2.35], ...'zxcvbnm'.split('').map((k) => [k, k.toUpperCase(), k.toUpperCase()]), [',', ',', ','], ['.', '.', '.'], ['/', '/', '/'], ['shift', 'shift', 'Shift', 2.65]],
      [['fn', 'fn', 'Fn'], ['ctrl', 'control', 'mod', 1.15], ['alt', 'option', 'Win'], ['mod', 'command', 'Alt', 1.35], ['space', '', '', 8.15], ['mod', 'command', 'Alt', 1.35], ['alt', 'option', 'Ctrl']],
    ];
    // On Windows & Linux the bottom row is Fn · Ctrl · Win · Alt · space · Alt · Ctrl, and Ctrl is "mod".
    const PC_BOTTOM = [['fn', 'Fn'], ['mod', 'Ctrl', 1.15], ['win', 'Win'], ['alt', 'Alt', 1.35], ['space', '', 8.15], ['alt', 'Alt', 1.35], ['mod', 'Ctrl']];
    const draw = () => {
      const rows = ROWS.map((r, i) => (plat === 'pc' && i === 4 ? PC_BOTTOM.map(([id, l, w]) => [id, l, l, w]) : r));
      kb.innerHTML = rows.map((r) => `<div class="kb-row">${r.map(([id, mac, pc, w = 1]) => `<span class="key${(plat === 'mac' ? mac : pc).length > 2 ? ' word' : ''}" data-k="${id.replace(/"/g, '&quot;')}" style="--w:${w}">${(plat === 'mac' ? { command: '⌘<small>command</small>', option: '⌥<small>option</small>', shift: '⇧<small>shift</small>', control: '⌃<small>control</small>' }[mac] : '') || (plat === 'mac' ? mac : pc)}</span>`).join('')}</div>`).join('');
      binds.forEach((b) => { const k = b.querySelector('kbd'); k.textContent = k.dataset[plat]; });
      document.querySelectorAll('.kbd-top [data-plat]').forEach((b) => b.classList.toggle('on', b.dataset.plat === plat));
    };
    const ids = (keys) => keys.split(/\+(?!$)/).flatMap((t) => (t === 'CmdOrCtrl' ? ['mod'] : t === 'Shift' ? ['shift'] : t === 'Alt' ? ['alt'] : t === '1-9' ? ['1'] : t === 'Hover' ? [] : [t.toLowerCase()]));
    const light = (list, bind) => {
      kb.querySelectorAll('.key').forEach((k) => k.classList.toggle('on', list.includes(k.dataset.k)));
      binds.forEach((b) => b.classList.toggle('on', b === bind));
      now.textContent = bind ? bind.querySelector('span').textContent : 'Press a shortcut';
      now.parentElement.classList.toggle('lit', !!bind);
    };
    document.querySelectorAll('.kbd-top [data-plat]').forEach((b) => b.addEventListener('click', () => { plat = b.dataset.plat; draw(); }));
    draw();

    let quietUntil = 0;
    binds.forEach((b) => {
      const show = () => { quietUntil = Date.now() + 6000; light(ids(b.dataset.keys), b); };
      b.addEventListener('mouseenter', show);
      b.addEventListener('focus', show);
      b.addEventListener('click', show);
      b.addEventListener('mouseleave', () => light([], null));
    });

    // Press the keys yourself: they light up, and a matching shortcut is named.
    const CODES = { Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", Space: 'space', Tab: 'tab', Escape: 'esc', Enter: 'return', Backspace: 'delete', CapsLock: 'caps' };
    const held = new Set();
    let seen = false;
    new IntersectionObserver(([e]) => { seen = e.isIntersecting; }, { threshold: 0.3 }).observe(kb);
    const keyId = (e) => {
      if (/^Meta/.test(e.code)) return plat === 'mac' ? 'mod' : 'win';
      if (/^Control/.test(e.code)) return plat === 'mac' ? 'ctrl' : 'mod';
      if (/^Alt/.test(e.code)) return 'alt';
      if (/^Shift/.test(e.code)) return 'shift';
      if (/^Key/.test(e.code)) return e.code.slice(3).toLowerCase();
      if (/^Digit/.test(e.code)) return e.code.slice(5);
      return CODES[e.code];
    };
    const match = () => binds.find((b) => {
      const want = new Set(ids(b.dataset.keys).map((k) => (k === '1' && b.dataset.keys.includes('1-9') ? 'digit' : k)));
      const got = new Set([...held].map((k) => (/^[1-9]$/.test(k) && b.dataset.keys.includes('1-9') ? 'digit' : k)));
      return want.size === got.size && [...want].every((k) => got.has(k));
    });
    document.addEventListener('keydown', (e) => {
      if (!seen || e.target.closest('input, textarea')) return;
      const id = keyId(e);
      if (!id) return;
      held.add(id);
      quietUntil = Date.now() + 6000;
      light([...held], match() ?? null);
    });
    document.addEventListener('keyup', (e) => {
      held.delete(keyId(e));
      if (/^Meta/.test(e.code)) held.clear(); // macOS swallows other keyups while ⌘ is held
      kb.querySelectorAll('.key').forEach((k) => k.classList.toggle('on', held.has(k.dataset.k)));
    });
    addEventListener('blur', () => held.clear());

    // When nobody is touching it, it shows one shortcut after another.
    let tour = 0;
    setInterval(() => {
      if (!seen || Date.now() < quietUntil || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const b = binds[tour++ % binds.length];
      light(ids(b.dataset.keys), b);
    }, 2200);
  }
})();
