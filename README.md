<p align="center"><img src="resources/icon.svg" width="96" height="96" alt="Extrovert logo"></p>

<h1 align="center">Extrovert</h1>

<p align="center"><b>All your communities. One space.</b></p>

Extrovert is a free, open-source desktop app that puts Facebook, Messenger, WhatsApp, Instagram, LinkedIn, Gmail, Google Calendar, Drive, Meet, Chat, and any website you like into one window. Every app is the real website, untouched. You get live unread badges, real notifications, and one workspace per Google account, so work and personal never mix.

- **Website:** https://pantho-haque.github.io/Extrovert
- **Download:** [latest release](https://github.com/Pantho-Haque/Extrovert/releases/latest) for macOS, Windows and Linux
- **Compared with Ferdium and Rambox:** [COMPETITIVE_ANALYSIS.md](COMPETITIVE_ANALYSIS.md)

No account with us, no server, no tracking. Everything stays on your computer.

---

## Contents

- [Install](#install)
- [Getting started](#getting-started)
- [Features](#features)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Privacy: what is stored, and where](#privacy-what-is-stored-and-where)
- [Troubleshooting](#troubleshooting)
- [Build from source](#build-from-source)
- [Contributing](#contributing)
- [License](#license)

---

## Install

Download the file for your computer from the [latest release](https://github.com/Pantho-Haque/Extrovert/releases/latest).

| System | File | Install |
|---|---|---|
| **macOS** (Apple silicon & Intel) | `Extrovert-<version>.dmg` | Open it and drag Extrovert to Applications. |
| **Windows** 10 and 11 | `Extrovert-Setup-<version>.exe` | Run it. |
| **Linux** | `Extrovert-<version>.AppImage` | `chmod +x Extrovert-*.AppImage`, then run it. |

### "Unidentified developer" warnings

Extrovert isn't signed with a paid Apple or Microsoft certificate yet, so your system warns you the first time. The code is public, so you can check exactly what you're running.

- **macOS:** if you see *"Extrovert can't be opened because Apple cannot check it for malicious software"*, open **System Settings → Privacy & Security**, scroll down, and click **Open Anyway**. Or run this once in Terminal:
  ```sh
  xattr -dr com.apple.quarantine /Applications/Extrovert.app
  ```
- **Windows:** on *"Windows protected your PC"*, click **More info → Run anyway**.

### Updates

Extrovert checks GitHub Releases at startup and every 6 hours, and tells you when a new version is out. You can switch to the **beta** channel in **Settings → Updates** to get new features earlier. The check sends no personal data.

---

## Getting started

1. **Sign in with Google.** Click **Continue with Google**. Your browser opens; pick an account. Extrovert only receives your name, email and photo, to create your workspace. It never sees your password, and it doesn't keep any Google tokens.
2. **Pick your services.** Choose any of Facebook, Messenger, WhatsApp, Instagram, LinkedIn, Gmail, Calendar, Drive, Meet and Chat, and paste the address of any other website you use. You can add more later with the **+** button.
3. **Log in to each service**, exactly as you would in a browser. Or, on macOS, use **Sign in with your browser** to copy the logins you already have in Arc, Chrome, Brave, Edge, Vivaldi, Opera or Chromium. All Google apps share one sign-in, and so do Facebook and Messenger.
   - **WhatsApp** always needs a QR scan from your phone (its login lives on your device, not in a cookie).
4. **Take the tour.** A short tour shows everything Extrovert can do. You can reopen it, and see every shortcut, from the **⌘** button in the sidebar, or with `⌘/` (`Ctrl+/` on Windows and Linux).

**Another Google account?** Click your photo at the top of the sidebar → **Add another account**. Each account gets its own workspace with its own logins. Switch with one click, or with `⌘⇧1`–`9` (`Ctrl+Shift+1`–`9` on Windows and Linux).

**Signing out** of a workspace deletes the logins and data of every service in it from your computer.

---

## Features

<!-- guide:features -->
### Workspaces

One per Google account. Work and personal never mix.

- **A workspace per Google account**: Sign in with Google once per account. Work and personal never mix.
- **Switch accounts in one click**: The Gmail-style account menu shows every account with its unread count. `⌘⇧1–9 / Ctrl+Shift+1–9`
- **Several accounts of the same app**: Two WhatsApps or three Gmails sit side by side, grouped and tagged so you never mix them up.
- **Logins stay in their workspace**: Signing out of a workspace deletes its logins and data from this computer.
- **Pause a workspace**: Paused workspaces don't run in the background, to save memory.
- **Work hours**: Outside a workspace's hours, its notifications stay quiet.

### Your apps, untouched

The real websites, plus any site you add.

- **Facebook, Messenger, WhatsApp, Instagram, LinkedIn and Google apps**: Gmail, Calendar, Drive, Meet and Chat included. Each runs its real web app.
- **Any website**: Paste an address to add any site, as many as you like. It keeps the site's own icon, or pick one from the built-in icon pack in any color.
- **Add several at once**: Pick every service you want and add them in one go. `⌘N / Ctrl+N`
- **One Google sign-in for every Google app**: Sign in once and Gmail, Calendar, Drive, Meet and Chat are all signed in, as that workspace's own account.
- **Sign in with your browser**: Already logged in to these sites in Arc, Chrome, Brave, Edge, Vivaldi, Opera or Chromium? Copy those logins instead of typing passwords. If a copied login expires, Extrovert copies it again by itself. *(macOS)*
- **Per-service settings**: Mute, badge, sound, zoom and video autoplay for each service. Right-click a service for more.

### Never miss what matters

Live badges and real notifications, minus the noise.

- **Live unread badges**: On every service, every account, and the dock or tray.
- **Notifications with previews**: Each service's own notifications, shown natively, with a full history. `⌘⇧N / Ctrl+Shift+N`
- **Next unread**: Jump to the next service with something new, across all accounts, until you reach inbox zero. `⌘J / Ctrl+J`
- **People view**: See who is waiting on you, grouped by person across platforms.
- **VIPs**: Messages from your VIPs break through Do Not Disturb and digests.
- **Do Not Disturb and digest**: Silence everything, or get one summary every hour instead of constant pings.
- **Snooze to the exact chat**: A snoozed notification reopens that exact conversation when it comes back.
- **While-you-were-away recap**: Back from a break? One card shows who wrote to you, and where.
- **Login watchdog**: If a service signs you out, you're told right away instead of silently missing messages.

### Stay in flow

Get anywhere in a keystroke.

- **Command palette**: Jump to any service, pin or action. Paste a link and it opens in the right app. `⌘K / Ctrl+K`
- **Smart links**: An Instagram link sent on WhatsApp opens in your Instagram, not a browser.
- **Peek**: See a live snapshot of another service without switching. `⌥ + hover / Alt + hover`
- **Pins**: Save any page inside a service, a group, a profile, a chat, and get back in one click.
- **Saved replies**: Paste text you type often into any chat. `⌘⇧R / Ctrl+Shift+R`
- **Find, back and forward**: Browser basics that work in every service. `⌘F / Ctrl+F`
- **Zen mode**: Hide the sidebar so the service fills the window. `⌘\ / Ctrl+\`
- **Downloads**: Everything you downloaded from any service, in one list.
- **Menu bar mini view**: Unread counts and the latest notifications, without opening the window.

### Calls & privacy

Your screen, your rules.

- **Camera, mic and screen indicators**: A live dot shows which service is using your camera, microphone or screen.
- **Call bubble**: Switch away during a call and it keeps going in a small floating window.
- **Screen-share shield**: While you share your screen, previews and other accounts are hidden automatically.
- **Lock & blur**: Blur and lock the whole app instantly, with a PIN or Touch ID. Optionally when you step away. `⌘⇧L / Ctrl+Shift+L`
- **Permissions dashboard**: See and revoke camera, microphone, screen, notification and location access per service.
- **Per-workspace proxy**: Route only one workspace through a proxy, such as your office network.
- **No tracking**: No analytics, no account with us, no server. Everything stays on your computer.

### Social media on your terms

See where your time goes. Set your own limits.

- **Time insights**: Private time per service and account, today and this week. Only counts while you actually use it.
- **Feed guard**: Daily budgets for feeds, with a gentle "still want to scroll?" Messaging is never limited.
- **No autoplay in feeds**: Videos in Facebook, Instagram and LinkedIn feeds wait for you to press play.

### Fast and dependable

Opens fast, recovers by itself.

- **Staggered startup**: Your last service opens first; the rest load quietly, messaging apps first.
- **Auto-recover**: After sleep or a Wi-Fi change, stuck services reload by themselves.
- **Smart sleep**: When memory runs low, idle feeds sleep first. Messaging apps stay awake.
- **Task manager**: Memory and CPU per service, with reload and sleep buttons.

### Easy to switch, easy to trust

Free, open source, yours to keep.

- **Import from Ferdium**: Bring your Ferdium services over in one step.
- **Export and import your setup**: Move your workspaces and settings to another computer as a file.
- **Updates from GitHub**: New versions install themselves from GitHub Releases. Beta channel available.
- **Report a problem**: Fills in a GitHub bug report for you, with app and system details but no personal data. You submit it on GitHub with a free account.
<!-- /guide:features -->

---

## Keyboard shortcuts

<!-- guide:shortcuts -->
| Action | macOS | Windows & Linux |
|---|---|---|
| Command palette: jump anywhere, or paste a link | `⌘K` | `Ctrl+K` |
| Next unread, across all accounts | `⌘J` | `Ctrl+J` |
| Switch service | `⌘1–9` | `Ctrl+1–9` |
| Switch account | `⌘⇧1–9` | `Ctrl+Shift+1–9` |
| Peek at a service without switching | `⌥ + hover` | `Alt + hover` |
| Notifications | `⌘⇧N` | `Ctrl+Shift+N` |
| Back | `⌘[` | `Ctrl+[` |
| Forward | `⌘]` | `Ctrl+]` |
| Reload service | `⌘R` | `Ctrl+R` |
| Find in page | `⌘F` | `Ctrl+F` |
| Saved replies | `⌘⇧R` | `Ctrl+Shift+R` |
| Zoom in | `⌘=` | `Ctrl+=` |
| Zoom out | `⌘-` | `Ctrl+-` |
| Actual size | `⌘0` | `Ctrl+0` |
| Add services | `⌘N` | `Ctrl+N` |
| Lock & blur instantly | `⌘⇧L` | `Ctrl+Shift+L` |
| Zen mode (hide the sidebar) | `⌘\` | `Ctrl+\` |
| Shortcuts & features | `⌘/` | `Ctrl+/` |
| Settings | `⌘,` | `Ctrl+,` |
| Developer tools for the service | `⌥⌘I` | `Alt+Ctrl+I` |
<!-- /guide:shortcuts -->

`⌘1`–`9` / `Ctrl+1`–`9` switches to the services in sidebar order; `⌘⇧1`–`9` / `Ctrl+Shift+1`–`9` switches to your accounts in order.

---

## Privacy: what is stored, and where

Extrovert has no server and no analytics. It talks only to the websites you add, to Google (to sign you in), and to GitHub (to check for updates).

| What | Where | Leaves your computer? |
|---|---|---|
| Your workspaces and services | `workspaces.json` in the data folder | No |
| Settings, notification history, time insights | `settings.json`, `history.json`, `usage.json` | No |
| Each service's logins, cookies and cache | `Partitions/` in the data folder, one folder per workspace login | Only to that service, like any browser |

**Data folder:** macOS `~/Library/Application Support/Extrovert` · Windows `%APPDATA%\Extrovert` · Linux `~/.config/Extrovert`.

- **Google sign-in** uses the standard secure flow for desktop apps (your system browser, PKCE, a one-time local address). Only your name, email and photo are used.
- **Sign in with your browser** (macOS) runs only when you click **Import**. macOS asks you to allow access to your browser's "Safe Storage" key. Extrovert uses it to read the logins of the services you picked, keeps it in memory only while it's running, and never writes it to disk. If a copied login expires later, Extrovert copies it again from the same browser by itself. Logging out of the service stops that.
- **Logins belong to their workspace.** Signing out of a workspace, logging out of a service, or removing a service deletes its logins and data.
- **Report a problem** (the ⌘ button in the sidebar, or the Help menu) fills in a GitHub bug report with your app version, system and service states, never names, emails or page addresses. It opens in your browser, and nothing is sent until you submit it there. You need a free GitHub account, and reports are public.

---

## Troubleshooting

**A service shows its login page.** Log in again inside it, or click **Use my browser's login** (macOS). If the login was copied from your browser, Extrovert first tries to copy it again by itself.

**Google says "This browser or app may not be secure".** Google sometimes blocks sign-ins inside desktop apps. Sign in to Google in your normal browser, then use **Sign in with your browser** to bring that login over.

**macOS keeps asking to allow access to "<Browser> Safe Storage".** Click **Always Allow** instead of **Allow**. Extrovert then refreshes expired logins without asking.

**No notifications.** Check that notifications are allowed for Extrovert in your system settings, that Do Not Disturb is off (moon icon in the sidebar), and that the service isn't muted (right-click it).

**A badge stopped updating.** Extrovert reads unread counts from each site's page title. If a site changes, right-click the service → **Reload**. If it stays wrong, please report it: click the **⌘** button in the sidebar → **Report a problem**.

**The app uses a lot of memory.** Each service is a full browser page. Open the **Task manager** (`⌘K` / `Ctrl+K` → Task manager) to see which service uses the most, put services to sleep, or pause a whole workspace.

**Start completely fresh.** Quit Extrovert and delete the data folder listed above. This signs you out of everything.

---

## Build from source

You need [Node.js](https://nodejs.org) 24 or newer and [pnpm](https://pnpm.io) 11 or newer.

```sh
git clone https://github.com/Pantho-Haque/Extrovert.git
cd Extrovert
pnpm install
cp .env.example .env    # then fill in the two Google values, see below
pnpm dev
```

### Google sign-in credentials

Extrovert signs you in with your own Google OAuth client. Creating one is free and takes a few minutes:

1. Open [Google Cloud Console](https://console.cloud.google.com) and create a project.
2. Go to **Google Auth Platform → Branding** and fill in the app name and your email. Under **Audience**, choose **External**.
3. Under **Data access**, add the scopes `openid`, `email` and `profile`. These are non-sensitive, so Google doesn't need to review them.
4. Under **Clients**, create a client of type **Desktop app**.
5. Copy the client ID and client secret into `.env`:
   ```sh
   MAIN_VITE_GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
   MAIN_VITE_GOOGLE_CLIENT_SECRET=GOCSPX-...
   ```
6. While the app is in **Testing** under **Audience**, only the test users you list can sign in, and their sign-ins expire after 7 days. Click **Publish app** to remove those limits.

Google treats a desktop app's client secret as not truly secret (it ships inside the app); the sign-in is protected by PKCE and a local redirect. Keep `.env` out of git anyway; it is already in `.gitignore`.

### Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Runs the app with live reload |
| `pnpm build` | Builds the app into `out/` |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm typecheck` | TypeScript checks |
| `pnpm test:e2e` | End-to-end checks against a real Electron window with a throwaway profile (never touches your logins) |
| `pnpm icons` | Renders the app, dock and tray icons in `resources/` from the logo |
| `pnpm sync-docs` | Rewrites the feature and shortcut lists in this README and on the website from the app |

### Project layout

```
src/
  core/      Pure logic with unit tests: service catalog, unread counts, notification rules,
             settings, workspaces, Google sign-in helpers, browser cookie decoding,
             and guide/registry.ts (every feature and shortcut)
  main/      Electron main process: windows, service views, notifications, tray, menu, updates
  preload/   The bridge to the app's own UI, and observe-only hooks inside service pages
  renderer/  The app's own UI (React)
  shared/    Types and the IPC contract between main and the UI
tests/e2e/   End-to-end driver and fixture
resources/   The logo (icon.svg) and the app, dock and tray icons made from it
docs/        The website (GitHub Pages)
proto/       The original visual prototype
```

**Found a bug?** In the app, click the **⌘** button in the sidebar → **Report a problem**; it fills in the details for you. Or [open a bug report](https://github.com/Pantho-Haque/Extrovert/issues/new?template=bug_report.yml) directly. Either way you need a free GitHub account.

---

## Contributing

Issues and pull requests are welcome.

- Every change needs `pnpm test`, `pnpm typecheck` and `pnpm test:e2e` to pass.
- Every bug fix comes with a test that proves it stays fixed.
- **Adding or changing a feature or shortcut?** Edit `src/core/guide/registry.ts`, then run `pnpm sync-docs`. The app menu, the Shortcuts & features panel, the feature tour, What's new, this README and the website all come from that file, and `pnpm test` fails if they're out of date.
- Extrovert never changes or automates the pages it shows. Features use only what a browser already knows: page titles, the sites' own notifications, addresses, and camera/microphone use.

---

## License

[MIT](LICENSE) © Pantho Haque
