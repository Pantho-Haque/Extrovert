// Drives a dev build of Extrovert through its features and saves screenshots + a JSON report.
// Run with `pnpm test:e2e`. Uses a throwaway profile and a local fixture page; never touches real logins.
const { app } = require('electron');
const fs = require('fs');
const OUT = process.env.EXTROVERT_E2E_OUT || '/tmp/extrovert-e2e';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async (x) => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const report = [];
  const step = (name, data = {}) => { report.push({ name, ...data }); console.log('[e2e]', name, JSON.stringify(data).slice(0, 400)); };
  const png = async (wc, file) => { try { fs.writeFileSync(`${OUT}/${file}.png`, (await wc.capturePage()).toPNG()); } catch (e) { step('capture-failed', { file, e: String(e) }); } };
  const shot = async (name) => {
    await png(x.shellView.webContents, `${name}-shell`);
    const inst = x.activeInstance();
    const wc = inst && x.views.webContents(inst.id);
    if (wc && !x.store.runtime.overlay) await png(wc, `${name}-page`);
  };
  const esc = async () => {
    x.shellView.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    x.shellView.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    await wait(500);
  };
  const statuses = () => Object.fromEntries(Object.entries(x.store.statuses).map(([id, s]) => [id, `${s.state}/${s.unread}/${s.icon ? 'icon' : 'noicon'}`]));

  const safe = async (name, fn) => { try { await fn(); } catch (e) { step(`${name}-error`, { e: String(e) }); } };
  x.showWindow();
  try {
    await wait(9000);
    step('boot', { statuses: statuses(), active: x.activeInstance()?.id });
    await shot('01-boot');

    // First run: the feature tour opens by itself, walks through every slide, and is remembered.
    const js = (code) => x.shellView.webContents.executeJavaScript(code);
    await safe('tour', async () => {
      const opened = await js(`!!document.querySelector('.tour')`);
      const slides = await js(`document.querySelectorAll('.tour-dots button').length`);
      for (let k = 0; k < slides - 1; k++) {
        await wait(1100); await png(x.shellView.webContents, `tour-${k}`);
        await js(`document.querySelector('.tour-f .btn.primary').click()`);
      }
      await wait(1100); await png(x.shellView.webContents, `tour-${slides - 1}`);
      await js(`document.querySelector('.tour-f .btn.primary').click()`); await wait(600);
      step('tour', { opened, slides, closed: !(await js(`!!document.querySelector('.tour')`)), remembered: x.store.settings.tourDone });
      if (!(opened && slides > 3 && x.store.settings.tourDone)) step('tour-failed', {});
    });

    await safe('guide', async () => {
      x.command('guide'); await wait(800);
      const total = await js(`document.querySelectorAll('.guide-f').length`);
      await png(x.shellView.webContents, 'guide');
      await js(`(() => { const i = document.querySelector('.guide-top input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'peek'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await wait(400);
      const filtered = await js(`document.querySelectorAll('.guide-f').length`);
      await esc();
      step('guide-panel', { total, filtered });
      if (!(total > 30 && filtered >= 1 && filtered < total)) step('guide-failed', {});
    });

    for (let k = 0; k < 16 && !x.store.history.length; k++) await wait(500);
    const n = x.store.history[0];
    step('notification-captured', { sender: n?.sender, body: n?.body, fixtureUnread: x.store.statuses['i-fix']?.unread });

    if (n) {
      x.notifier.open(n.id);
      await wait(1500);
      step('click-opens-exact-chat', { pageTitle: x.store.statuses['i-fix']?.title });
    }

    x.goNextUnread();
    await wait(800);
    step('next-unread', { active: x.activeInstance()?.id });

    x.selectWorkspace('w-work');
    await wait(4000);
    step('switch-workspace', { activeWs: x.store.activeWorkspace?.id, active: x.activeInstance()?.id });
    // LinkedIn isn't signed in (no li_at cookie): Extrovert should know, and offer the browser's login.
    for (let k = 0; k < 20 && x.store.statuses['i-li']?.signedIn === undefined; k++) await wait(500);
    step('signed-in-from-cookie', { linkedinSignedIn: x.store.statuses['i-li']?.signedIn });
    step('offer-browser-login', { toast: x.store.runtime.toasts.map((t) => t.text).find((t) => t.includes('Already signed in')) ?? null });
    await shot('02-work');
    x.selectWorkspace('w-test');
    x.selectInstance('w-test', 'i-fix');
    await wait(1500);

    for (const cmd of ['accountMenu', 'palette', 'replies', 'settings', 'notifications', 'insights', 'taskManager', 'addService']) {
      x.command(cmd);
      await wait(1200);
      const open = x.store.runtime.overlay;
      await shot(`ov-${cmd}`);
      await esc();
      step(`overlay-${cmd}`, { raisedWhileOpen: open, closedByEscape: !x.store.runtime.overlay });
    }

    // Every shortcut: present in the real app menu exactly once (no clash with Electron's built-in
    // Edit/Window shortcuts either), and pressing it does what it says.
    await safe('shortcuts', async () => {
      const { Menu } = require('electron');
      const mac = process.platform === 'darwin';
      const MODS = { Command: 'CmdOrCtrl', Cmd: 'CmdOrCtrl', CommandOrControl: 'CmdOrCtrl', CmdOrCtrl: 'CmdOrCtrl', Control: mac ? 'Ctrl' : 'CmdOrCtrl', Ctrl: mac ? 'Ctrl' : 'CmdOrCtrl', Option: 'Alt', Alt: 'Alt', Shift: 'Shift' };
      const norm = (a) => { const t = a.split('+'); const key = t.pop(); return [...new Set(t.map((m) => MODS[m] ?? m))].sort().concat(key.toUpperCase()).join('+'); };
      const items = [];
      const walk = (m) => m.items.forEach((it) => {
        const acc = it.accelerator || (it.role && it.getDefaultRoleAccelerator?.());
        if (acc) items.push({ it, acc: norm(acc), label: it.label || it.role });
        if (it.submenu) walk(it.submenu);
      });
      walk(Menu.getApplicationMenu());
      const byAcc = new Map();
      for (const i of items) byAcc.set(i.acc, [...(byAcc.get(i.acc) ?? []), i]);
      const clashes = [...byAcc].filter(([, l]) => l.length > 1).map(([a, l]) => `${a}: ${l.map((i) => i.label).join(' / ')}`);
      const registry = fs.readFileSync(require('path').join(app.getAppPath(), 'src/core/guide/registry.ts'), 'utf8');
      const keysOf = Object.fromEntries([...registry.matchAll(/\{ id: '(\w+)', keys: '([^']+)'/g)].map(([, id, keys]) => [id, keys.replace(/\\\\/g, '\\')]));
      const missing = Object.entries(keysOf).filter(([, k]) => !/1-9|Hover/.test(k) && !byAcc.has(norm(k))).map(([id]) => id);
      const press = (keys) => byAcc.get(norm(keys))[0].it.click();

      const results = {};
      const check = async (id, fn) => { try { results[id] = (await fn()) === true; } catch (e) { results[id] = String(e); } };
      const dialog = () => js(`document.querySelector('[role=dialog]')?.getAttribute('aria-label') ?? (document.querySelector('.nc') ? 'Notifications' : null)`);
      const opens = (id, label) => check(id, async () => { press(keysOf[id]); await wait(700); const got = await dialog(); await esc(); await wait(300); return got === label; });
      const calls = (id, obj, method) => check(id, async () => {
        const orig = obj[method]; let n = 0;
        obj[method] = function (...a) { n++; return orig.apply(this, a); };
        try { press(keysOf[id]); await wait(400); } finally { obj[method] = orig; }
        return n === 1;
      });

      await opens('palette', 'Command palette');
      await opens('replies', 'Saved replies');
      await opens('notifications', 'Notifications');
      await opens('addService', 'Add services');
      await opens('guide', 'Shortcuts & features');
      await opens('settings', 'Settings');
      await calls('nextUnread', x, 'goNextUnread');
      x.selectInstance('w-test', 'i-fix'); await wait(500);
      await calls('reload', x, 'reload'); await wait(1500);
      await check('find', async () => { press(keysOf.find); await wait(400); const ok = !!x.store.runtime.find; x.stopFind(); return ok; });
      const zoom = () => x.store.locate('i-fix').inst.zoom;
      await check('zoomIn', async () => { const z = zoom(); press(keysOf.zoomIn); await wait(200); return zoom() === z + 10; });
      await check('zoomOut', async () => { const z = zoom(); press(keysOf.zoomOut); await wait(200); return zoom() === z - 10; });
      await check('zoomReset', async () => { press(keysOf.zoomIn); press(keysOf.zoomReset); await wait(200); return zoom() === 100; });
      await check('zen', async () => { const z = x.store.runtime.zen; press(keysOf.zen); await wait(200); const ok = x.store.runtime.zen !== z; press(keysOf.zen); await wait(200); return ok; });
      await check('lock', async () => { press(keysOf.lock); await wait(900); const ok = x.store.runtime.locked; await x.unlock({}); await wait(400); return ok && !x.store.runtime.locked; });
      const page = () => x.views.webContents('i-fix');
      await check('back', async () => {
        // As user actions: Chromium's Back skips entries a script added on its own.
        await page().executeJavaScript(`location.hash = 'a'`, true); await wait(200);
        await page().executeJavaScript(`location.hash = 'b'`, true); await wait(200);
        press(keysOf.back); await wait(500);
        return page().getURL().endsWith('#a');
      });
      await check('forward', async () => { press(keysOf.forward); await wait(500); return page().getURL().endsWith('#b'); });
      await check('devtools', async () => { press(keysOf.devtools); await wait(1500); const ok = page().isDevToolsOpened(); page().closeDevTools(); await wait(300); return ok; });
      await check('service', async () => {
        press('CmdOrCtrl+2'); await wait(500); const moved = x.activeInstance()?.id !== 'i-fix';
        press('CmdOrCtrl+1'); await wait(500); return moved && x.activeInstance()?.id === 'i-fix';
      });
      await check('workspace', async () => {
        press('CmdOrCtrl+Shift+2'); await wait(800); const moved = x.store.activeWorkspace?.id === 'w-work';
        press('CmdOrCtrl+Shift+1'); await wait(800); return moved && x.store.activeWorkspace?.id === 'w-test';
      });
      x.selectInstance('w-test', 'i-fix'); await wait(600);
      await check('peek', async () => {
        const wc = x.shellView.webContents;
        const [px, py] = await js(`(() => { const b = document.querySelectorAll('.svc-list .svc')[1].getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
        wc.sendInputEvent({ type: 'mouseMove', x: 400, y: 400 }); await wait(150);
        wc.sendInputEvent({ type: 'mouseMove', x: Math.round(px), y: Math.round(py), modifiers: ['alt'] }); await wait(1500);
        const ok = !!x.store.runtime.peek;
        wc.sendInputEvent({ type: 'mouseMove', x: 400, y: 400 }); await wait(200);
        x.store.runtime.peek = null; x.store.emit();
        return ok;
      });

      const failed = Object.entries(results).filter(([, v]) => v !== true);
      step('shortcuts', { menuItems: items.length, clashes, missing, tested: Object.keys(results).length, failed });
      if (clashes.length || missing.length || failed.length) step('shortcuts-failed', {});
    });

    // Report a problem: fills in a GitHub issue, warns about needing a GitHub account, never leaks personal data.
    await safe('report', async () => {
      const { shell } = require('electron');
      const realOpen = shell.openExternal;
      let opened = '';
      shell.openExternal = async (url) => { opened = url; };
      try {
        x.command('feedback'); await wait(900);
        const warns = await js(`document.querySelector('.report-modal .note.warn')?.textContent.includes('GitHub account') ?? false`);
        const disabledEmpty = await js(`document.querySelector('.report-modal .btn.primary').disabled`);
        await js(`(() => {
          const set = (el, v) => { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
          set(document.querySelector('.report-modal input.field'), 'Badge stuck at 0');
          set(document.querySelector('.report-modal textarea'), 'It never updates');
        })()`);
        await wait(700);
        await png(x.shellView.webContents, 'report');
        await js(`document.querySelector('.report-modal .btn.primary').click()`); await wait(600);
        const params = opened ? Object.fromEntries(new URL(opened).searchParams) : {};
        const personal = ['test@example.com', 'Personal', 'Fixture'].filter((s) => opened.includes(encodeURIComponent(s)) || opened.includes(s));
        step('report-problem', { warns, disabledEmpty, template: params.template, title: params.title, severity: params.severity, system: params.system, personal });
        if (!(warns && disabledEmpty && params.template === 'bug_report.yml' && params.title === 'Badge stuck at 0' && params.system && !personal.length)) step('report-failed', {});
      } finally {
        shell.openExternal = realOpen;
      }
    });

    // A website you add keeps its own icon (favicon): shown in the Add services preview, then saved on
    // the service (shrunk to 64 px), so it shows even before the page loads.
    await safe('site-icon', async () => {
      const preview = await js(`window.extrovert.do('siteIcon', { url: 'http://127.0.0.1:8765/site.html' })`);
      const [id] = x.addInstances('w-test', [{ type: 'custom', url: 'http://127.0.0.1:8765/site.html', label: 'Site' }]);
      for (let k = 0; k < 20 && !x.store.locate(id)?.inst.siteIcon; k++) await wait(250);
      const saved = x.store.locate(id)?.inst.siteIcon ?? '';
      const size = saved ? require('electron').nativeImage.createFromDataURL(saved).getSize() : null;
      x.removeInstance('w-test', id);
      x.selectInstance('w-test', 'i-fix');
      step('site-icon-saved', { preview: String(preview).slice(0, 22), saved: saved.slice(0, 22), size });
      if (!(String(preview).startsWith('data:image/png') && saved.startsWith('data:image/png') && size?.width === 64)) step('site-icon-failed', {});
    });

    // A website you add can get an icon from the pack and a color; both are saved and editable later.
    await safe('look', async () => {
      const setInput = (sel, v) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      const idsBefore = new Set(x.store.workspace('w-test').instances.map((i) => i.id));
      x.command('addService'); await wait(900);
      await setInput('.custom-url input', 'web.telegram.org'); await wait(400);
      await js(`[...document.querySelectorAll('.cu-prev .btn')].find((b) => b.textContent.includes('Icon'))?.click()`); await wait(500);
      const suggested = await js(`document.querySelectorAll('.look-grid button:not(.site)')[0]?.title`);
      await js(`document.querySelectorAll('.look-grid button:not(.site)')[0].click()`); await wait(200);
      await js(`document.querySelectorAll('.look-colors .sw')[1].click()`); await wait(300);
      await png(x.shellView.webContents, 'look-picker');
      await js(`document.querySelector('.modal-f .btn.primary').click()`); await wait(1200);
      const added = x.store.workspace('w-test').instances.find((i) => !idsBefore.has(i.id));
      x.command('settings'); await wait(800);
      await js(`[...document.querySelectorAll('.settings nav button')].find((b) => b.textContent.includes('Services')).click()`); await wait(500);
      await js(`document.querySelector('.look-btn')?.click()`); await wait(400);
      const editable = await js(`!!document.querySelector('.look-row .look-grid')`);
      await png(x.shellView.webContents, 'look-settings');
      await esc();
      step('custom-icon-and-color', { suggested, icon: added?.icon, color: added?.color, editable });
      if (!(suggested === 'Telegram' && added?.icon === 'brand-telegram' && added?.color === '#0EA5E9' && editable)) step('look-failed', {});
      if (added) x.removeInstance('w-test', added.id);
      x.selectInstance('w-test', 'i-fix');
    });

    x.toggleZen(); await wait(500); await shot('zen'); x.toggleZen();

    x.command('find'); await wait(600);
    x.find('Fixture', true, false); await wait(700);
    step('find', { find: x.store.runtime.find });
    await png(x.floating.webContents()[1], 'find-panel');
    x.stopFind();

    await x.lock(); await wait(900);
    step('lock', { locked: x.store.runtime.locked, hasSnapshot: !!x.store.runtime.lockImage });
    await shot('lock');
    const un = await x.unlock({});
    step('unlock-without-pin', un);
    await wait(400);

    await safe('peek', async () => { await x.peek('w-test', 'i-wa', 68, 160); });
    await wait(900);
    step('peek', { hasImage: !!x.store.runtime.peek?.image, activeStillFixture: x.activeInstance()?.id === 'i-fix' });
    await png(x.floating.webContents()[2], 'peek-panel');
    x.store.runtime.peek = null; x.store.emit();

    x.toast('Test toast from the e2e script', { actions: [{ label: 'Open', action: 'nextUnread' }] }); await wait(800);
    await png(x.floating.webContents()[0], 'toasts-panel');

    x.sleep('i-gm'); await wait(300);
    step('sleep', { gmail: x.store.statuses['i-gm']?.state, hasView: x.views.has('i-gm') });
    x.wake(x.store.workspace('w-test'), x.store.locate('i-gm').inst); await wait(300);
    step('wake', { gmail: x.store.statuses['i-gm']?.state, hasView: x.views.has('i-gm') });

    const [ig] = x.addInstances('w-test', [{ type: 'instagram' }]);
    await wait(1500);
    x.selectInstance('w-test', 'i-fix');
    x.routeLink('i-fix', 'https://www.instagram.com/nadia.clicks');
    await wait(1200);
    step('smart-link', { active: x.activeInstance()?.id, isInstagram: x.activeInstance()?.id === ig });
    x.removeInstance('w-test', ig);
    x.selectInstance('w-test', 'i-fix');

    x.store.runtime.feedGuard = { workspaceId: 'w-test', instanceId: 'i-fix', todayMin: 32, budgetMin: 30 }; x.store.emit();
    await wait(1000); await shot('feed-guard');
    x.usage.answerFeedGuard('continue'); await wait(400);

    x.notifier.recap(Date.now() - 3_600_000); await wait(1000);
    step('recap', { open: !!x.store.runtime.recap });
    await shot('recap');
    x.store.runtime.recap = null; x.store.emit(); await wait(400);

    x.store.runtime.permissionPrompt = { id: 'p1', workspaceId: 'w-test', instanceId: 'i-wa', what: 'camera and microphone' }; x.store.emit();
    await wait(900); await shot('permission');
    x.store.runtime.permissionPrompt = null; x.store.emit(); await wait(400);

    step('metrics', { metrics: x.metrics() });

    // Google apps open as the workspace's own account (the browser may hold several Google accounts).
    // Watch the first page request Gmail makes when it opens (redirects later hide it from history).
    const gses = require('electron').session.fromPartition('persist:w-test:google');
    let gmailFirst = '';
    gses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (d, cb) => { if (!gmailFirst && d.resourceType === 'mainFrame') gmailFirst = d.url; cb({}); });
    x.sleep('i-gm', false);
    x.wake(x.store.workspace('w-test'), x.store.locate('i-gm').inst);
    for (let k = 0; k < 20 && !gmailFirst; k++) await wait(250);
    gses.webRequest.onBeforeRequest(null);
    step('google-opens-workspace-account', { firstUrl: gmailFirst, ok: gmailFirst.includes('authuser=test%40example.com') });
    if (!gmailFirst.includes('authuser=test%40example.com')) step('google-account-failed', {});

    // One Google sign-in covers every Google app in the workspace, including apps added later.
    const added = x.addInstances('w-test', [{ type: 'calendar' }, { type: 'drive' }]);
    const sessions = ['i-gm', ...added].map((id) => x.store.locate(id).inst.session);
    await require('electron').session.fromPartition('persist:w-test:google').cookies.set({ url: 'https://www.google.com', name: 'SID', value: 'e2e-test', domain: '.google.com', expirationDate: Date.now() / 1000 + 3600 });
    // Only the apps added later are checked: Gmail itself loads real Google, which rejects this fake cookie.
    for (let k = 0; k < 20 && !added.every((id) => x.store.statuses[id]?.signedIn); k++) await wait(250);
    const signed = added.map((id) => x.store.statuses[id]?.signedIn);
    step('shared-google-login', { addedTwoAtOnce: added.length === 2, sessions, signed });
    if (!(added.length === 2 && sessions.every((k) => k === 'google') && signed.every(Boolean))) step('shared-login-failed', {});
    for (const id of added) x.removeInstance('w-test', id);
    x.selectInstance('w-test', 'i-fix');

    // An expired login that came from a browser is copied again from it. Here that browser is gone,
    // so it must fall back to the signed-out screen once (no hang, no loop), and logging out forgets it.
    await safe('resync', async () => {
      const ws = x.store.workspace('w-test');
      ws.loginSources = { google: { browserId: 'gone', browserName: 'Gone Browser', profileDir: 'Default' } };
      x.store.locate('i-gm').inst.signedInOnce = true;
      x.store.patchStatus('i-gm', { state: 'live' });
      await gses.cookies.remove('https://www.google.com', 'SID');
      for (let k = 0; k < 30 && x.store.statuses['i-gm']?.state !== 'signedout'; k++) await wait(250);
      const tried = x.resyncedAt.has('w-test:google');
      step('resync-fallback', { tried, state: x.store.statuses['i-gm']?.state });
      if (!(tried && x.store.statuses['i-gm']?.state === 'signedout')) step('resync-failed', {});
      await x.logOutInstance('i-gm');
      step('logout-forgets-source', { source: ws.loginSources.google ?? null });
      if (ws.loginSources.google) step('forget-source-failed', {});
    });

    // Background activity must never pull the window in front of another app.
    x.win.blur();
    await wait(300);
    const focusedBefore = x.win.isFocused();
    x.reload('i-wa');
    await x.checkSignedIn('i-li').catch(() => undefined);
    x.showActive();
    await wait(4000);
    step('no-focus-steal', { focusedBefore, focusedAfter: x.win.isFocused() });
    if (!focusedBefore && x.win.isFocused()) step('focus-steal-failed', {});

    x.command('addService'); await wait(1200); await shot('catalog'); await esc();
    x.command('settings'); await wait(1000); await shot('settings-account');
    const openSection = (label) => x.shellView.webContents.executeJavaScript(`[...document.querySelectorAll('.settings nav button')].find((b) => b.textContent.includes(${JSON.stringify(label)}))?.click()`);
    const modalHeight = () => x.shellView.webContents.executeJavaScript(`document.querySelector('.settings-modal')?.getBoundingClientRect().height`);
    const heights = [await modalHeight()];
    await openSection('Services'); await wait(600); await shot('settings-services'); heights.push(await modalHeight());
    await openSection('Shortcuts'); await wait(600); heights.push(await modalHeight());
    await openSection('About'); await wait(600); heights.push(await modalHeight());
    step('settings-fixed-height', { heights, same: new Set(heights.map(Math.round)).size === 1 });
    if (new Set(heights.map(Math.round)).size !== 1) step('settings-height-failed', {});
    await esc();
    x.command('taskManager'); await wait(2500); await shot('task-manager-2'); await esc();
    // Logins belong to their workspace: sign-out deletes them; leftover folders are removed at next start.
    const path = require('path');
    const partDir = path.join(app.getPath('userData'), 'Partitions');
    const before = fs.readdirSync(partDir);
    const liCookiesBefore = (await require('electron').session.fromPartition('persist:w-work:i-li').cookies.get({})).length;
    await x.signOut('w-work');
    const liCookiesAfter = (await require('electron').session.fromPartition('persist:w-work:i-li').cookies.get({})).length;
    step('sign-out-deletes-logins', {
      folderFormatOk: before.includes('w-work%3Ai-li') && before.includes('w-test%3Ai-fix'),
      workspaceGone: !x.store.workspace('w-work'),
      cookiesBefore: liCookiesBefore, cookiesAfter: liCookiesAfter,
    });
    if (!(before.includes('w-work%3Ai-li') && !x.store.workspace('w-work') && liCookiesAfter === 0)) step('sign-out-failed', {});
    step('final', { overlay: x.store.runtime.overlay, statuses: statuses(), historyCount: x.store.history.length });

    // Quitting closes the window first: no timer may touch it afterwards ("Object has been destroyed" on ⌘Q).
    let ticks = 0;
    x.usage.tick = () => { ticks++; };
    await wait(1500);
    const ticksBefore = ticks;
    x.win.emit('closed');
    await wait(2500);
    step('timers-stop-on-close', { ticking: ticksBefore > 0, ticksAfterClose: ticks - ticksBefore });
    if (!(ticksBefore > 0 && ticks === ticksBefore)) step('timers-failed', {});
  } catch (e) {
    step('error', { e: String(e && e.stack || e) });
  }
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  setTimeout(() => app.quit(), 500);
};
