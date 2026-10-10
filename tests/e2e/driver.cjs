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
    for (let k = 0; k < 20 && !['i-gm', ...added].every((id) => x.store.statuses[id]?.signedIn); k++) await wait(250);
    const signed = ['i-gm', ...added].map((id) => x.store.statuses[id]?.signedIn);
    step('shared-google-login', { addedTwoAtOnce: added.length === 2, sessions, signed });
    if (!(added.length === 2 && sessions.every((k) => k === 'google') && signed.every(Boolean))) step('shared-login-failed', {});
    for (const id of added) x.removeInstance('w-test', id);
    x.selectInstance('w-test', 'i-fix');

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
  } catch (e) {
    step('error', { e: String(e && e.stack || e) });
  }
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  setTimeout(() => app.quit(), 500);
};
