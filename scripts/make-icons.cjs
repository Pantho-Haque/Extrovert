// Renders the app icons from Logo A ("The Hello"). Run: pnpm icons
// resources/icon.svg is the master; everything else here is generated from these shapes.
const { app, BrowserWindow } = require('electron');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const OUT = join(__dirname, '..', 'resources');
const GRAD = '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366F1"/><stop offset=".55" stop-color="#A855F7"/><stop offset="1" stop-color="#EC4899"/></linearGradient>';
const FIGURE = '<path d="M15 23C15.5 35 22 45 32 45S48.5 35 49 23" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cx="32" cy="31" r="7" fill="#fff"/><circle cx="15" cy="20" r="5.2" fill="#fff"/><circle cx="49" cy="20" r="5.2" fill="#fff"/>';
// One color, heavier strokes: still clear at 16 px in a menu bar.
const MONO = '<path d="M11 22C11.5 38 20 50 32 50S52.5 38 53 22" fill="none" stroke="#000" stroke-width="7.5" stroke-linecap="round"/><circle cx="32" cy="32" r="8.5"/><circle cx="11" cy="17.5" r="7"/><circle cx="53" cy="17.5" r="7"/>';

const ICONS = {
  // App icon in the macOS grid: an 824 px tile with a soft shadow, centred on 1024. Used for the dock,
  // the About panel, Windows/Linux windows and the installers.
  'icon.png': [1024, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs>${GRAD}<filter id="s" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-opacity=".28"/></filter></defs><g transform="translate(100 88) scale(12.875)" filter="url(#s)"><rect width="64" height="64" rx="14.4" fill="url(#g)"/>${FIGURE}</g></svg>`],
  // Windows / Linux tray: the full-color tile.
  'tray.png': [32, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${GRAD}</defs><rect width="64" height="64" rx="15" fill="url(#g)"/>${FIGURE}</svg>`],
  // macOS menu bar: black on transparent; the "Template" name lets macOS tint it for light and dark bars.
  'trayTemplate.png': [16, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${MONO}</svg>`],
  'trayTemplate@2x.png': [32, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${MONO}</svg>`],
};

app.whenReady().then(async () => {
  // Draw each one at 1024 px, then scale down: small sizes come out sharper than drawing them small.
  const w = new BrowserWindow({ show: false, width: 1024, height: 1024, transparent: true, frame: false, backgroundColor: '#00000000', webPreferences: { offscreen: true } });
  for (const [file, [size, svg]] of Object.entries(ICONS)) {
    await w.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:1024px;height:1024px}</style>${svg}`)}`);
    await new Promise((r) => setTimeout(r, 300));
    const img = await w.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
    writeFileSync(join(OUT, file), img.resize({ width: size, height: size, quality: 'best' }).toPNG());
    console.log('wrote', file, size);
  }
  app.quit();
});
