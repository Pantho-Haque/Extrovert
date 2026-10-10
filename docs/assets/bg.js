/*
 * The page background: your apps as a slowly drifting network. Now and then a message travels along
 * a link from one app to another, and the receiving app's unread badge pops, then clears a while
 * later as if read. That is what Extrovert does all day. Purely decorative: nothing here is real.
 */
(() => {
  const canvas = document.createElement('canvas');
  canvas.className = 'bg';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dark = matchMedia('(prefers-color-scheme: dark)');

  const BRANDS = [['whatsapp', '#25D366'], ['messenger', '#A033FF'], ['instagram', '#DD2A7B'], ['facebook', '#1877F2'], ['linkedin', '#0A66C2'], ['gmail', '#EA4335'], ['telegram', '#29B6F6'], ['slack', '#E01E5A'], ['calendar', '#4285F4'], ['meet', '#00897B']];
  /** Each app's real icon (from the page's own sprite) as an image, tinted with its brand color. */
  const icons = Object.fromEntries(BRANDS.map(([id, color]) => {
    const symbol = document.getElementById(`b-${id}`);
    const img = new Image();
    if (symbol) img.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${symbol.innerHTML}</svg>`)}`;
    return [id, img];
  }));

  let W = 0, H = 0, nodes = [], pulses = [];
  const LINK = 230;
  const rand = (a, b) => a + Math.random() * (b - a);

  function setup() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(9, Math.min(24, Math.round((W * H) / 60000)));
    nodes = Array.from({ length: count }, (_, i) => ({
      x: rand(0, W), y: rand(0, H), vx: rand(-0.12, 0.12), vy: rand(-0.12, 0.12),
      size: rand(30, 44), brand: BRANDS[i % BRANDS.length], unread: 0, popAt: 0, readAt: 0,
    }));
    pulses = [];
  }

  const mouse = { x: -1e4, y: -1e4 };
  addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  addEventListener('resize', () => { setup(); if (still) draw(performance.now()); });

  function send(now) {
    const from = nodes[Math.floor(Math.random() * nodes.length)];
    const near = nodes.filter((n) => n !== from && Math.hypot(n.x - from.x, n.y - from.y) < LINK);
    const to = near[Math.floor(Math.random() * near.length)];
    if (to) pulses.push({ from, to, start: now, dur: rand(1100, 1700) });
  }

  function roundRect(x, y, s, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + s, y, x + s, y + s, r); ctx.arcTo(x + s, y + s, x, y + s, r); ctx.arcTo(x, y + s, x, y, r); ctx.arcTo(x, y, x + s, y, r);
    ctx.closePath();
  }

  let nextSend = 0;
  function draw(now) {
    const isDark = dark.matches;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = isDark ? 0.7 : 0.5;

    // Drift, wrap around the edges, and lean away from the pointer.
    for (const n of nodes) {
      const dx = n.x - mouse.x, dy = n.y - mouse.y, d = Math.hypot(dx, dy);
      if (d < 140 && d > 0) { n.x += (dx / d) * 0.6; n.y += (dy / d) * 0.6; }
      n.x += n.vx; n.y += n.vy;
      if (n.x < -60) n.x = W + 60; if (n.x > W + 60) n.x = -60;
      if (n.y < -60) n.y = H + 60; if (n.y > H + 60) n.y = -60;
      if (n.unread && now > n.readAt) n.unread = 0; // read it
    }

    // Links between nearby apps.
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > LINK) continue;
      ctx.strokeStyle = `rgba(99, 102, 241, ${(1 - d / LINK) * (isDark ? 0.28 : 0.22)})`;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // Messages on their way; on arrival, the app's badge pops.
    if (now > nextSend) { send(now); nextSend = now + rand(700, 1600); }
    pulses = pulses.filter((p) => {
      const t = (now - p.start) / p.dur;
      if (t >= 1) {
        p.to.unread = Math.min(9, p.to.unread + 1);
        p.to.popAt = now; p.to.readAt = now + rand(5000, 11000);
        return false;
      }
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const x = p.from.x + (p.to.x - p.from.x) * e, y = p.from.y + (p.to.y - p.from.y) * e;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 12);
      glow.addColorStop(0, 'rgba(165, 180, 252, .95)'); glow.addColorStop(1, 'rgba(99, 102, 241, 0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
      return true;
    });

    // The apps themselves: brand-tinted tiles with their real icon, and an unread badge.
    for (const n of nodes) {
      const [id, color] = n.brand, s = n.size, x = n.x - s / 2, y = n.y - s / 2;
      roundRect(x, y, s, s * 0.26);
      ctx.fillStyle = `${color}${isDark ? '2e' : '24'}`; ctx.fill();
      ctx.strokeStyle = `${color}${isDark ? '55' : '44'}`; ctx.stroke();
      const img = icons[id];
      if (img.complete && img.naturalWidth) ctx.drawImage(img, n.x - s * 0.3, n.y - s * 0.3, s * 0.6, s * 0.6);
      if (n.unread) {
        const age = (now - n.popAt) / 450;
        const scale = age < 1 ? (age < 0.6 ? 0.5 + age * 1.25 : 1.25 - (age - 0.6) * 0.625) : 1;
        const bx = x + s - 2, by = y + 2, r = 9 * scale;
        ctx.fillStyle = '#EF4444'; ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(11 * scale)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(n.unread), bx, by + 0.5);
      }
    }
    ctx.globalAlpha = 1;
    if (!still) requestAnimationFrame(draw);
  }

  setup();
  if (still) Object.values(icons).forEach((img) => img.addEventListener('load', () => draw(performance.now())));
  requestAnimationFrame(draw);
})();
