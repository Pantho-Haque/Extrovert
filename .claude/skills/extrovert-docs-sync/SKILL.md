---
name: extrovert-docs-sync
description: Use after ANY change to Extrovert's features, shortcuts, services, settings, privacy behaviour, install or build steps. Keeps the in-app feature tour, Shortcuts & features panel, What's new, README, landing page (docs/index.html) and COMPETITIVE_ANALYSIS.md true to the app.
---

# Keep Extrovert's docs, tour and website in sync

The tour, the in-app panel, the README and the website are part of the product. When the app changes, they change in the same task, never "later".

## 1. The registry is the source of truth

`src/core/guide/registry.ts` holds every feature (`FEATURE_GROUPS`) and every shortcut (`SHORTCUTS`). These are generated from it, so editing the registry updates them all:

- App menu accelerators (`src/main/menu.ts` uses `accel()`)
- Shortcuts & features panel and the feature tour (`src/renderer/src/Guide.tsx`)
- Settings → Shortcuts, onboarding shortcuts, palette and tooltips (`keyOf()`)
- What's new (features with `added: '<version>'`)
- README blocks `<!-- guide:features -->`, `<!-- guide:shortcuts -->`
- Landing page blocks `guide:icons`, `guide:highlights`, `guide:features`, `guide:shortcuts`

Rules:
- New or changed feature → add or edit its entry (title, one-sentence text, `shortcut`, `where`, `macOnly`).
- New feature in a release → `added: '<that version>'` so What's new shows it.
- Removed feature → delete its entry. Never list something that isn't built.
- `unique: true` only when competitor research confirms Ferdium, Rambox, Wavebox and Shift lack it.
- Unique features also carry `icon` and `details` (the website's expandable highlight cards), and a small simulated picture in `docs/assets/site.js` (`ART`, keyed by the title as a slug). A new unique feature needs all three; a card without a picture still works.
- Never hard-code a key combo in UI code; use `keyOf(id, isMac)` / `accel(id)`.

Then run `pnpm sync-docs`. `pnpm test` fails if README or docs/index.html are out of date.

## 2. Hand-written parts to review every time

Check each against the change; fix anything no longer true:

- **README.md**: Install, Getting started, Privacy table, Troubleshooting, Build from source (env vars, Google client steps), Scripts, Project layout.
- **docs/index.html**: hero copy, comparison table, Privacy rows, Install steps, FAQ.
- **docs/assets/bg.js**: the living background (the app icons as a network, messages travelling, badges popping). Keep its app list in step with the services Extrovert supports.
- **docs/assets/demo.js**: the interactive replica of the app (sidebar, badges, account menu, ⌘K palette, ⌘J, peek, zen, lock, notifications). When the app's look or a shown behaviour changes, change the demo too; its styles in docs/assets/site.css copy the app's tokens and components from src/renderer/src/styles.css.
- **COMPETITIVE_ANALYSIS.md**: claims about Extrovert (e.g. Drive sync is still planned, not built).
- In-app copy that explains the feature (onboarding, empty states, settings descriptions).

## 3. Verify

`pnpm typecheck && pnpm test && pnpm test:e2e`. For website changes, render docs/index.html (light and dark) and look at it.

## The logo

Logo A ("The Hello") is the only logo. Master: `resources/icon.svg`. If it changes, also update `Brand` in `src/renderer/src/ui.tsx`, the copies in `docs/` (logo.svg, favicon.svg, the header and `#logo-a` in index.html, `.brand-mark` in site.css), the shapes in `scripts/make-icons.cjs`, then run `pnpm icons`.

## Releases

Installers have stable names (`Extrovert-mac.dmg`, `Extrovert-Setup.exe`, `Extrovert-linux.AppImage`, `Extrovert-linux.deb`; see `electron-builder.yml`). The README, website and `src/main/updates.ts` link to them; rename them everywhere at once. New features in a release get `added: '<version>'` in the registry.

## Facts to keep straight

- Not built yet (don't claim): Drive sync, tracker blocking, translations, signed/notarized builds (macOS updates are a manual download), browser-login import on Windows/Linux and from Firefox/Safari.
- Data folder: macOS `~/Library/Application Support/Extrovert`, Windows `%APPDATA%\Extrovert`, Linux `~/.config/Extrovert`.
- Repo: https://github.com/Pantho-Haque/Extrovert · site: https://pantho-haque.github.io/Extrovert (GitHub Pages from `docs/`).
