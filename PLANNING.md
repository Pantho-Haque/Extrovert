# Extrovert: Planning & Requirements Analysis

> Status: Draft v2 · 2026-10-09
> Goal: One desktop workspace where Facebook, Messenger, WhatsApp, Instagram, LinkedIn, Google apps, and any custom web app run side by side. Each one looks exactly like its real web app and has live notification badges. Workspaces are tied to Google accounts and switch with one click.

### Decisions log
| # | Decision | Answer |
|---|---|---|
| D1 | Platforms | macOS, Windows, Linux |
| D2 | Users | Sign in with Google. Each Google account is its own **workspace**, and you switch between them with one click. |
| D3 | Extensibility | Built-in catalog (social + Google apps), plus **add any service by URL** |
| D4 | Name | **Extrovert** |
| D5 | Language | TypeScript |
| D6 | Code quality | Well-organised, modular codebase. Unit tests are mandatory and enforced in CI. |
| D7 | No AI | Extrovert has no AI features. It is a single space where all your communities live together, nothing more. |
| D8 | Distribution | GitHub Releases only (no app stores). Install steps live in the README. Source code is **public**. |
| D9 | Code signing | Not for now. Mac users see a "can't verify developer" warning on first launch (README explains right-click → Open), and Mac updates are manual until signing is added. |

---

## 1. The key decision: how this can work at all

| Approach | Works? | Why |
|---|---|---|
| **Website + iframes** of facebook.com, web.whatsapp.com, etc. | ❌ No | These sites send `X-Frame-Options` / CSP `frame-ancestors` headers that block embedding. You'd see a blank box. |
| **Website + official APIs** (Graph API, WhatsApp Cloud API, LinkedIn API) | ❌ No | No API exposes a *personal* news feed or personal Messenger/Instagram/WhatsApp chats. We'd also have to rebuild every UI ourselves. |
| **Desktop app (Electron) hosting each real web app in its own embedded browser view** | ✅ Yes | Each service runs the real website, so the UI is identical. You log in on the real site, sessions persist, and unread counts are readable. |

**Decision:** Electron + React + TypeScript. Each service runs in its own isolated `WebContentsView` with the official web app loaded.

- Inside each view you get the **real** Facebook, Messenger, WhatsApp Web, Instagram, LinkedIn, Gmail, and so on. We don't redesign them.
- Extrovert never sees your social-media passwords, because you log in on each platform's own page.
- Extrovert's own UI is the **shell** around the services: the workspace switcher, sidebar, badges, notification center, settings, and command palette.

---

## 2. Scope

### In scope (v1)
- Desktop app for **macOS, Windows, Linux**.
- **Google sign-in** for the app itself, with multiple Google accounts. Each account gets its own workspace.
- Built-in services: Facebook, Messenger, WhatsApp, Instagram, LinkedIn, Gmail, Google Calendar, Google Drive, Google Meet, Google Chat.
- Custom services added by URL.
- Live unread badges per service and per workspace, native OS notifications, and a notification history.

### Out of scope (v1)
- Mobile app.
- A unified inbox, or cross-posting to several platforms. That needs APIs that don't exist for personal accounts.
- Scraping, automation, or bots inside services, which would break the platforms' Terms of Service.
- Syncing login sessions between machines. Cookies stay on the device for security reasons. Only *workspace configuration* can sync (FR-W08).
- AI features of any kind (product decision D7).
- Our own backend server. Google covers identity and optional sync.

---

## 3. Users & Concepts

| Concept | Meaning |
|---|---|
| **Google account** | Identity used to sign in to Extrovert. You can add several. |
| **Workspace** | One per Google account. It has its own set of services, its own logins for each service, and its own settings and notification rules. Workspaces are fully isolated from each other. |
| **Service** | A web app type: Facebook, Gmail, or a custom URL. |
| **Service instance** | One running copy of a service inside a workspace. A workspace can hold two Facebook instances, for example, each with its own login. |

**Primary user:** an individual managing several personal identities (for example personal + work) and their social accounts on one or more computers. The app stays open all day.

---

## 4. Functional Requirements

Priorities: **M** = Must (v1), **S** = Should (v1 if time allows), **C** = Could (later).

### 4.1 Authentication & Workspaces (Google accounts)
| ID | Requirement | Priority |
|---|---|---|
| FR-W01 | First launch shows **Sign in with Google**. Sign-in runs in the **system browser** using OAuth 2.0 + PKCE with a loopback redirect. Google requires this for desktop apps and blocks OAuth inside embedded views. Scopes: `openid email profile`. | M |
| FR-W02 | Each signed-in Google account creates a **workspace** named after the account, showing its avatar and email. | M |
| FR-W03 | The user can add more Google accounts from the workspace switcher. | M |
| FR-W04 | **Account menu (Gmail-style):** the current workspace's avatar sits at the top of the sidebar. Clicking it opens a dropdown with the current account, every other signed-in Google account (each with its unread count and paused/muted state), **Add another account**, and **Sign out of all accounts**. One click on an account switches to it. The avatar's badge shows unread items in the *other* accounts. Shortcut: `Cmd/Ctrl+Shift+1…9`. Adding an account that is already signed in never creates a duplicate. | M |
| FR-W05 | Each workspace's service sessions are fully isolated: partition `persist:<workspaceId>:<instanceId>`. Facebook in workspace A never sees cookies from workspace B. | M |
| FR-W06 | Logins belong to their workspace. Signing out of a Google account removes its workspace **and deletes every service login and all data in it** from this computer; signing in again starts it fresh. On startup, any login storage that no longer belongs to a workspace (removed services, older versions) is deleted. | M |
| FR-W07 | Google tokens are stored encrypted with the OS keychain (Electron `safeStorage`), never in plain JSON. | M |
| FR-W08 | **Config sync via the user's own Google Drive** (`drive.appdata` hidden app folder): service list, order, and settings follow the user to another machine. No Extrovert server is involved. | S |
| FR-W09 | Rename a workspace and give it a color (useful when two accounts share an avatar). | S |
| FR-W10 | Background workspaces keep running by default, so their badges stay live. A setting lets the user **suspend inactive workspaces** to save RAM, and the switcher shows "paused" for those. | S |
| FR-W11 | App lock: PIN or OS biometrics (Touch ID / Windows Hello) when the app opens or after idle time. | C |

### 4.2 Navigation & Layout
| ID | Requirement | Priority |
|---|---|---|
| FR-N01 | One main window: a **sidebar** with the workspace switcher, service icons, and settings, plus the active service filling the rest of the window. | M |
| FR-N02 | Switching services is instant. Views stay loaded, so there are no reloads and no lost scroll or chat position. | M |
| FR-N03 | The active service is clearly marked with an accent bar and a highlight. Tooltips show the name and unread count. | M |
| FR-N04 | Shortcuts: `Cmd/Ctrl+1…9` service, `Cmd/Ctrl+Tab` cycle, `Cmd/Ctrl+R` reload, `Cmd/Ctrl+[` / `]` back/forward, `Cmd/Ctrl+F` **find in page**. | M |
| FR-N05 | The app remembers the last workspace, last service, and window size/position. | M |
| FR-N06 | **Command palette** (`Cmd/Ctrl+K`): fuzzy-jump to any service in any workspace, and run any action (reload, mute, settings). | S |
| FR-N07 | Drag-and-drop reorder of service icons, per workspace. | S |
| FR-N08 | Split view: two services side by side. | C |

### 4.3 Service Hosting ("same as the real app")
| ID | Requirement | Priority |
|---|---|---|
| FR-S01 | Built-in catalog: Facebook (`facebook.com`), Messenger (`facebook.com/messages`, configurable because messenger.com is being folded into Facebook), WhatsApp (`web.whatsapp.com`), Instagram (`instagram.com`), LinkedIn (`linkedin.com/feed`), Gmail, Google Calendar, Drive, Meet, Chat. | M |
| FR-S02 | **Add custom service:** paste a URL, and the app auto-detects the name and favicon. The user can edit them. Badge detection uses the generic title rule. | M |
| FR-S03 | Multiple accounts of the same service in one workspace, each with its own login. In the sidebar they sit **together in one grouped tray**, and each icon carries a small tag: a number, or the first letter of the nickname the user gave it (e.g. **B** for "WhatsApp · Business"). The nickname also appears in tooltips, notifications, and the command palette. | S |
| FR-S04 | The app sends a standard Chrome user-agent, with no `Electron/` token, so services don't block or degrade the view. | M |
| FR-S05 | Links outside the service's domains open in the system browser. Login/OAuth popups and links inside the service's own domains stay inside the view. | M |
| FR-S06 | Camera, microphone, and **screen sharing** (via `desktopCapturer` picker) work for calls in WhatsApp, Messenger, Meet, and LinkedIn. Permission is asked once per instance and can be changed in settings. | M |
| FR-S07 | File upload, drag-and-drop files into a service, and downloads (to the system Downloads folder) all work. | M |
| FR-S08 | Each service has loading, offline, and error/crashed states with a **Retry/Reload** button. A crashed service never takes down the app. | M |
| FR-S09 | Context menu: copy, paste, copy link, open in browser, save image, and spellcheck suggestions (with a language setting). | S |
| FR-S10 | Per-instance zoom (`Cmd/Ctrl + / - / 0`), remembered. | S |
| FR-S11 | Enable/disable a service without deleting it. | S |
| FR-S12 | Hibernate a service after N minutes unused. Its badge then shows "paused". | S |

### 4.4 Real-time Notifications (core feature)
| ID | Requirement | Priority |
|---|---|---|
| FR-A01 | Each service icon shows a **live unread badge**: a red count for direct items, or a dot for "something new" when there's no number. The cap is `99+`. | M |
| FR-A02 | Badges update within ~1–2 s **even in background services and background workspaces**. | M |
| FR-A03 | **Detection pipeline** for each service: (1) the page-title count `(3) …` read from Electron's `page-title-updated` event, with no page injection; (2) the service's own Web Notifications captured by wrapping `window.Notification` in the preload; (3) an optional per-service DOM selector fallback, defined in config. | M |
| FR-A04 | **Workspace-level badge:** each workspace avatar in the switcher shows the total unread count for that workspace. You can see that your work account has 5 new items without switching to it. | M |
| FR-A05 | Native OS notifications **with a preview** (sender/title + body), plus the service icon and workspace name. Clicking one switches to the right workspace and service. | M |
| FR-A06 | The dock/taskbar badge shows the total across all workspaces. | M |
| FR-A07 | **Notification center:** a panel listing recent notifications from every service and workspace, with filters and "open". It's stored locally, and the user sets how long items are kept. | S |
| FR-A08 | **Badge health indicator:** if a service's detection stops working (no title or notification signal for a long time while the page is loaded), the app shows a small warning in settings instead of silently showing 0. | S |
| FR-A09 | Per-instance controls: badge on/off, OS notification on/off, sound on/off, and a "count toward totals" toggle. | S |
| FR-A10 | Global Do Not Disturb. Badges still update, but alerts and sounds are muted. | S |
| FR-A11 | **Work hours per workspace** (e.g. Work: Mon–Fri 9:00–18:00). Outside those hours, that workspace is muted and can optionally be suspended. When you open the app, it starts on the workspace whose hours are active now. | S |

### 4.5 Settings & Personalization
| ID | Requirement | Priority |
|---|---|---|
| FR-P01 | Settings sections: Account & Workspaces, Services, Notifications, Appearance, Shortcuts, Privacy & Data, About/Updates. | M |
| FR-P02 | Shell theme: Light / Dark / System. Services keep their own themes. | M |
| FR-P03 | Per-instance "Log out / Clear data" (wipes the partition), plus "Reset everything". | M |
| FR-P04 | Launch at login, and minimize to tray/menu bar. | S |
| FR-P05 | Export/import workspace config as a JSON file, as a backup without Drive sync. | S |

### 4.6 App Lifecycle
| ID | Requirement | Priority |
|---|---|---|
| FR-L01 | Only one app instance runs at a time. Opening it again focuses the existing window. | M |
| FR-L02 | Auto-update on all 3 OSes with **no server of our own**: GitHub Releases is the update server (see §7.4). The app checks at startup and every 6 hours, downloads in the background, and installs on the next restart, or right away if the user clicks "Restart now". Users can turn off automatic checks and use "Check for updates" instead. | M |
| FR-L03 | Crash/error logging to a local log file the user can open from settings. Nothing is uploaded. | S |

### 4.7 Signature features (what makes Extrovert unique)

Theme: **"Be social without being managed by social media."** Every feature below uses only the signals we already have: unread counts, the services' own notifications, navigation URLs, call/media state, and which view is active. None of them modify a service's page or automate it, so NFR-01 and NFR-08 still hold.

> **Uniqueness check (Oct 2026):** Wavebox already has focus mode, a unified unread list, link-opening rules, and cross-app search. Rambox has work hours. We don't claim those as unique. As far as our research shows, the **Attention, Flow, Privacy, and Wellbeing** features below aren't offered by Ferdium, Rambox, Wavebox, or Shift. The **Performance, Productivity, Trust, and Growth** groups are mostly features users already expect (Wavebox has pins, for example). They're there so Extrovert is complete and dependable on day one, not to be unique. Re-verify before any marketing claim.

#### Attention: never miss what matters, ignore what doesn't
| ID | Feature | What you get | How it works | Priority |
|---|---|---|---|---|
| FR-X01 | **Jump to next unread** | `Cmd/Ctrl+J` takes you to the next service with unread items, **across all workspaces**, oldest first. Press it repeatedly until you're at inbox zero everywhere. | Ordered queue built from UnreadAggregator timestamps | M |
| FR-X02 | **Login watchdog** | If any service gets logged out (expired session, password change), its icon shows a "signed out" state and you get one alert. Today, other hubs just show 0 forever, so you silently miss messages. | Catalog defines `loginUrlPatterns`. A navigation to a login page marks the instance as signed out. | M |
| FR-X03 | **Snooze to the exact chat** | Snooze any notification (15 min / 1 h / tonight / tomorrow). When it fires, clicking it opens **that exact conversation**, not just the app. | The preload keeps the page's original `Notification` object, and on wake we fire its own `click` handler, which the site uses to open the chat. If the page has reloaded since, we fall back to opening the service. | S |
| FR-X04 | **VIP people** | Mark people (e.g. "Mom", "Boss") as VIP. Their messages break through DND and digests on **every platform**, with a distinct sound. | Match the sender name in the notification title against the VIP list (exact or alias). Local only. | S |
| FR-X05 | **Notification digest** | Non-VIP notifications are held and delivered as one grouped summary every 30/60/120 min, or at set times. Badges stay live; only the interruptions are batched. | AttentionEngine queue with release rules, per workspace | S |
| FR-X06 | **While-you-were-away recap** | When you come back from idle, sleep, or a meeting, one card shows who messaged you on which platform, with each item clickable. | Built from notification history plus the `powerMonitor` idle/resume events | S |
| FR-X07 | **People view** | Today your notifications are sorted by *app*: 3 on WhatsApp, 2 on LinkedIn. This view sorts them by *person*: "Rahim: 2 WhatsApp messages, 1 LinkedIn message · Sara: 1 Instagram DM". You see at a glance **who** is waiting for a reply, wherever they wrote. If Rahim shows as "Rahim Ahmed" on LinkedIn, you link the two names once, and they stay merged. | Groups notification history by sender name. Name links are made by the user, never guessed. | C |

#### Flow: stay in context
| ID | Feature | What you get | How it works | Priority |
|---|---|---|---|---|
| FR-X08 | **Peek** | Hold `Alt` and hover any service icon (even in another workspace) to see a live snapshot of it without switching. | `webContents.capturePage()` on hover, throttled | S |
| FR-X09 | **Call bubble** | When you're in a WhatsApp, Messenger, or Meet call and switch to another service, the call pops out into a small always-on-top floating window. Click it to return. | Detect an active call from the media-stream lifecycle (FR-X10), then re-parent that service's `WebContentsView` into a small floating `BaseWindow` | S |

#### Privacy: your screen, your rules
| ID | Feature | What you get | How it works | Priority |
|---|---|---|---|---|
| FR-X10 | **Mic / camera / screen in-use indicator** | The sidebar icon shows a live red mic, camera, or screen dot on whichever service is using them, even in background workspaces. | Permission handler + preload observes the start/end of `getUserMedia`/`getDisplayMedia` tracks | S |
| FR-X11 | **Screen-share shield** | While you share your screen from any service, Extrovert automatically hides notification previews and other workspaces' badges and avatars, so nothing private leaks to your audience. | Triggered by `setDisplayMediaRequestHandler` and the share-ended event | S |
| FR-X12 | **Privacy blur & panic key** | `Cmd/Ctrl+Shift+L` instantly blurs the whole window, mutes everything, and locks the app (when app lock is on). Optional auto-blur on idle. | Shell overlay drawn above the views (blurred `capturePage` image), never inside the page | S |
| FR-X13 | **Per-workspace network route (proxy)** | A proxy is a middleman server your internet traffic passes through. Some companies require work apps to go through theirs, and some users want a different country or IP for one identity. With this, *only* the chosen workspace uses that route. Example: your Work workspace goes through the office proxy, while your Personal workspace uses your normal connection. Without it, you'd have to change it for your whole computer. | `session.setProxy()` on that workspace's partitions only | C |

#### Wellbeing: social media on your terms
| ID | Feature | What you get | How it works | Priority |
|---|---|---|---|---|
| FR-X14 | **Time insights** | A private dashboard showing time per service and workspace, today and this week, with trends. | UsageTracker counts a second **only when all are true**: (1) the Extrovert window is focused, (2) the service is the one on screen, (3) the user is active (keyboard/mouse in the last 60 s), **or** that service is playing video/audio (so watching a reel without touching the mouse still counts). It stops when you switch to another app, minimize, lock the screen, or switch service. Stored locally. | S |
| FR-X15 | **Feed guard** | Opt-in, for feed services (Facebook, Instagram, LinkedIn). Set daily budgets; after N minutes of continuous feed time, a gentle overlay asks "Still want to scroll?" with Continue / Take a break. Messaging services are never limited. | Shell overlay above the view, plus UsageTracker budgets. Off by default. | S |

#### Performance & reliability: the hub that never misses a message
| ID | Feature | What you get | How it works | Priority |
|---|---|---|---|---|
| FR-X16 | **Staggered startup** | The app opens instantly on your last service. The others load quietly in the background, with messaging apps first, so the computer doesn't freeze when the app opens. | Load queue: active service → messaging → feeds → rest, one at a time | M |
| FR-X17 | **Auto-recover after sleep / Wi-Fi change** | Opening your laptop lid no longer means WhatsApp stuck on "connecting" or a dead Facebook tab. Extrovert checks every service and reloads the stuck ones. | On `powerMonitor` resume and network `online`, reload services in an offline or error state, then re-run the login watchdog | M |
| FR-X18 | **Smart hibernation** | When your computer runs low on memory, Extrovert puts the least-used *feed* services to sleep first. Messaging services stay awake, so you don't miss messages. | Watches system memory, ranks services by last use and type, and hibernates from the bottom of the list | S |
| FR-X19 | **Task manager** | A list showing how much memory and CPU each service uses, with Reload and Sleep buttons. You can see which app is slowing things down. | `app.getAppMetrics()` mapped to service views | S |
| FR-X20 | **No autoplay** | Per service, stop videos in feeds from playing by themselves. This saves CPU, battery and mobile data. | Chromium autoplay policy per view (a browser setting, not a page change) | S |

#### Productivity: do more without leaving the app
| ID | Feature | What you get | How it works | Priority |
|---|---|---|---|---|
| FR-X21 | **Smart link opening** | Paste a Facebook, Instagram, LinkedIn or WhatsApp link into `Cmd+K`, and it opens inside the right service. If someone sends you an Instagram link on WhatsApp, it opens in your Instagram tab instead of an outside browser. If several workspaces have that service, you pick which one. | URL matching against the catalog domains. Automatic, no rules to set up. | S |
| FR-X22 | **Pins** | Save any page inside a service (a Facebook group, a LinkedIn profile, a Messenger chat) and get back to it in one click, from `Cmd+K` or by right-clicking the service icon. | Saved URL + workspace + instance | S |
| FR-X23 | **Saved replies** | Store text you type often (addresses, "Thanks, will get back to you"). Press `Cmd+Shift+V` in any service's text box, pick one, and it's pasted. | Snippet list. The chosen text is pasted with the browser's normal paste command, exactly as if you pressed Cmd+V. | S |
| FR-X24 | **Zen mode** | `Cmd+\` hides the sidebar, so the service fills the whole window. Notifications still reach you. | Shell layout toggle | S |
| FR-X25 | **Menu-bar / tray mini view** | Click the Extrovert icon in the menu bar (macOS) or tray (Windows/Linux) to see a small panel with unread counts per workspace and the latest notifications, without opening the full window. | Small tray window that reads from the aggregator and history | S |
| FR-X26 | **Downloads panel** | One list of everything downloaded from any service, showing where it came from, with Open and Show in folder. | `will-download` events from each session | S |

#### Trust & switching: easy to adopt, easy to trust
| ID | Feature | What you get | How it works | Priority |
|---|---|---|---|---|
| FR-X27 | **Import from Ferdium** | Bring your Ferdium service list over in one step. You only have to log in to each service again. | Reads Ferdium's exported JSON. Known services map to the catalog, and others become custom URLs. | S |
| FR-X28 | **Permissions dashboard** | One screen showing which service may use your camera, microphone, screen, notifications or location, with a toggle to revoke each one. | The permission handler's decisions, stored per instance | S |
| FR-X29 | **Tracker blocking** (opt-in) | Blocks third-party trackers at the network level, per workspace. It doesn't hide sponsored posts inside feeds, because those come from the site itself. | Network request filtering only, with no page changes. Off by default, since it can break some sites. | C |

#### Product & growth: built for a public launch
| ID | Feature | What you get | How it works | Priority |
|---|---|---|---|---|
| FR-X30 | **Translation-ready from day 1** | Every word in Extrovert's own interface lives in translation files, so new languages can be added without touching code. English ships first. | i18n library + string files, plus a lint rule that rejects hard-coded UI text | M |
| FR-X31 | **What's new & feedback** | After an update, a short card shows what changed. "Send feedback" opens a pre-filled bug report or email that you review before sending. Nothing is sent automatically. | Changelog bundled with each release | S |
| FR-X32 | **Stable & beta channels** | Early adopters can opt into beta builds and help test new features before everyone gets them. | `electron-updater` channels | S |

---

## 5. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Fidelity | Service UIs are untouched: **no CSS or DOM changes**. Preloads only *observe* signals (Notification, media-stream lifecycle). Shell overlays (feed guard, privacy blur) are drawn above the view, never inside the page. |
| NFR-02 | Performance | Service switch takes < 100 ms. Workspace switch takes < 300 ms. Cold start to the sidebar takes < 2 s. |
| NFR-03 | Memory | ≈ 300–500 MB per live service (it's Chromium). Hibernation and suspending workspaces are the relief valves. |
| NFR-04 | Security | Service views use `contextIsolation`, `sandbox`, and no `nodeIntegration`. Preload bridges are minimal and typed. IPC senders are validated. A strict CSP applies to the shell. Tokens are encrypted with `safeStorage`. |
| NFR-05 | Privacy | No backend, no analytics, no telemetry. Session data stays on the device. Sync uses only the user's own Drive app folder. |
| NFR-06 | Reliability | Title-first detection, so there are no fragile "recipes". All service specifics live in one declarative catalog file. |
| NFR-07 | UX & a11y | System font, 150–200 ms transitions, no layout shift, keyboard-navigable sidebar, `aria-label`s, visible focus, WCAG AA contrast, `prefers-reduced-motion` support, and thin overlay scrollbars that appear only while hovering a scrollable area. |
| NFR-08 | Compliance | Extrovert acts purely as a browser for the official web clients, with no automation or scraping. |
| NFR-09 | Portability | One codebase builds to dmg (macOS, signed + notarized), nsis (Windows, signed), and AppImage/deb (Linux). |
| NFR-10 | Maintainability | Electron stays within 1 major version of latest. Dependabot/Renovate keeps dependencies current. A Chromium security fix ships within 2 weeks of its Electron release. |
| NFR-11 | Code quality | See §8. Strict TypeScript, modular feature folders, and enforced layer boundaries. |
| NFR-12 | Test integrity | See §9. Unit tests are mandatory, and CI blocks merges on failing tests or a coverage drop. |

---

## 6. UI / UX Design

### 6.1 Layout
```
┌──────┬────────────────────────────────────────────────────┐
│ (A)⁵▾│  ← current account; click → account menu           │
│ ──── │                                                    │
│  f³  │                                                    │
│  💬• │          Active service (real web app,             │
│ 🟢¹² │           full-bleed, untouched)                   │
│ 🟢ᴮ¹ │  ← 2nd WhatsApp account: grouped, tagged B         │
│  📷  │                                                    │
│  in⁵ │                                                    │
│  M²  │  ← Gmail                                           │
│  ＋  │  ← add service (catalog / custom URL)              │
│ ──── │                                                    │
│  🔔  │  ← notification center                             │
│  ⚙   │                                                    │
└──────┴────────────────────────────────────────────────────┘
  68px
```
- **No top toolbar**, so services look exactly like the real apps. Navigation is in shortcuts, the context menu, and the command palette.
- On macOS the window is frameless, with traffic lights inset into the sidebar. On Windows/Linux it uses native title bar controls.
- Badges are a red pill with a pop animation when the count goes up. Paused or hibernated services show a greyscale icon.
- The current account's avatar has a ring in the workspace's color and a small ▾ to show it opens the account menu. The active service has a 3 px accent bar.
- Scrollbars are thin and only appear while hovering the area that scrolls.

### 6.2 Design tokens (shell only)
- Font: system stack (`-apple-system, Segoe UI, Inter, sans-serif`).
- Neutral greys, plus accent `#4F46E5` and badge red `#EF4444`, each with light and dark variants.
- Radius 10–12 px, 8 px spacing grid, shadows only on overlays (palette, modals, notification center).
- Motion: 150 ms ease-out, and `prefers-reduced-motion` is respected.

### 6.3 Key screens
1. **First launch (no accounts yet):** the window shows only the welcome screen, with no sidebar and no badges. It has the Extrovert logo, the tagline "All your communities. One space.", a row of supported service logos plus "+ any site", one **Continue with Google** button, three short promises (every app untouched · never miss a thing · private by design), and a line explaining that Google only provides the name, email, and photo. After sign-in: pick services → shortcuts tips → workspace.
2. **Pick services:** catalog grid with toggles, plus an "Add custom URL" field.
3. **Workspace:** sidebar plus active service. This is the main screen.
4. **Notification center:** a slide-over panel grouped by workspace and service.
5. **Command palette:** a centered overlay with a fuzzy list.
6. **Service states:** loading skeleton, offline, crashed, and paused, each with a single clear action.
7. **Settings:** left nav, right content.
8. **Permission prompt:** "WhatsApp (Personal) wants to use your microphone", Allow / Deny, remember.

---

## 7. Technical Architecture

### 7.1 Stack
| Layer | Choice | Reason |
|---|---|---|
| Runtime | **Electron** (latest stable) | Hosts real sites with persistent, isolated sessions. |
| Language | **TypeScript** (strict) | Type-safe IPC contracts across processes. |
| Build | **electron-vite** | One Vite config for main, preload, and renderer, with HMR. |
| Shell UI | **React** | |
| Styling | **Tailwind CSS** | Maps directly to the design tokens. |
| State | React state + context | The shell is small, so we'll add a state library only if it's needed. |
| Persistence | **electron-store** (config) + `safeStorage` (tokens) | |
| Google auth | OAuth 2.0 PKCE, loopback redirect, system browser | Google's required flow for desktop apps. |
| Packaging | **electron-builder** + `electron-updater` | Covers all 3 OSes. |
| Lint/format | ESLint (typescript-eslint) + Prettier | |
| Tests | **Vitest**, React Testing Library, **Playwright (Electron)** | See §9. |
| CI | GitHub Actions, macOS / Windows / Linux matrix | |

### 7.2 Process model
```
Main process
 ├─ BaseWindow
 │   ├─ WebContentsView: Shell UI (React)
 │   └─ WebContentsView × N: service instances
 │        partition = persist:<workspaceId>:<instanceId>
 ├─ AuthManager        → Google OAuth, tokens in safeStorage
 ├─ WorkspaceManager   → create/switch/suspend workspaces
 ├─ ViewManager        → create/show/hide/hibernate views, bounds
 ├─ UnreadAggregator   → per instance → per workspace → dock total
 ├─ NotificationBridge → native notifications + history store
 ├─ AttentionEngine    → VIP, digest, snooze, away recap, next-unread queue
 ├─ SessionWatchdog    → detects logged-out services
 ├─ MediaMonitor       → mic/cam/screen state, call bubble, screen-share shield
 ├─ UsageTracker       → time insights, feed guard budgets
 ├─ SyncManager        → Drive appdata (optional)
 └─ SettingsStore      → electron-store

Service preload (sandboxed)
 ├─ wraps window.Notification → ipc 'notify' (keeps the original object for snooze-to-chat)
 └─ observes getUserMedia/getDisplayMedia track start/end → ipc 'media'
    (title counts come from the main-process 'page-title-updated' event, with no injection needed)
```

### 7.3 Service catalog (single declarative file)
```ts
// src/core/services/catalog.ts: the only place platform specifics live
export const catalog: ServiceDefinition[] = [
  { id: 'facebook',  name: 'Facebook',  url: 'https://www.facebook.com/',          domains: ['facebook.com', 'fbcdn.net'] },
  { id: 'messenger', name: 'Messenger', url: 'https://www.facebook.com/messages/', domains: ['facebook.com', 'messenger.com'] },
  { id: 'whatsapp',  name: 'WhatsApp',  url: 'https://web.whatsapp.com/',          domains: ['whatsapp.com'] },
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/',         domains: ['instagram.com'] },
  { id: 'linkedin',  name: 'LinkedIn',  url: 'https://www.linkedin.com/feed/',     domains: ['linkedin.com'] },
  { id: 'gmail',     name: 'Gmail',     url: 'https://mail.google.com/',           domains: ['google.com'] },
  // calendar, drive, meet, chat …
];
// Default unread rule: /^\((\d+)\+?\)/ on the title. `unreadSelector` is optional, added only when the title rule isn't enough.
```

---

### 7.4 Updates without a server
GitHub Releases acts as the update server for free. `electron-updater` handles the client side.

```
Developer                         GitHub Releases (public)             User's Extrovert
─────────                         ────────────────────────             ────────────────
git tag v1.2.0 → CI builds,  ──►  v1.2.0/                         ◄──  every 6 h: fetch latest.yml
signs, uploads                     ├─ Extrovert-1.2.0.dmg               1.2.0 > 1.1.0? → download
                                   ├─ Extrovert-Setup-1.2.0.exe         verify sha512 + code signature
                                   ├─ Extrovert-1.2.0.AppImage          "Update ready, restart now?"
                                   └─ latest.yml / latest-mac.yml /
                                      latest-linux.yml (version + hashes)
```
- **Publishing a release** = pushing a git tag. CI builds all 3 OSes, signs them, and uploads them. No manual steps.
- **Beta channel (FR-X32)** = a GitHub *pre-release*. Only users who opted into beta receive it.
- **Integrity:** every download is checked against the sha512 in `latest*.yml` and the OS code signature before it's installed.
- **The releases repo must be public.** Users can't download from a private repo without a token. The source code can stay private in a separate repo, with CI publishing only the binaries to a public `extrovert-releases` repo.
- **macOS:** auto-update **only works on signed and notarized builds** (Apple requirement), so signing is required, not optional.
- **Windows:** works when unsigned, but SmartScreen shows "unknown publisher" warnings until the build is signed.
- **Linux:** the AppImage updates itself. `.deb` installs can't self-update, so for those the app only shows a "New version available → Download" notice.
- **Privacy:** the update check is a plain file download from GitHub. It sends no user data, though GitHub sees the user's IP address like any download. This is stated in Privacy settings.
- **Fallback:** if we ever leave GitHub, `electron-updater`'s `generic` provider works with any static file host (Cloudflare R2, S3, GitHub Pages) with no code changes beyond the config.

### 7.5 Configuration & environment variables

**End users configure nothing.** No env vars and no config files are needed to run Extrovert. Everything below is for developers and CI.

**Build-time env vars** (`.env` locally, CI secrets in GitHub; `.env` is git-ignored and `.env.example` is committed):

| Variable | Used for | Notes |
|---|---|---|
| `MAIN_VITE_GOOGLE_CLIENT_ID` | Google sign-in (FR-W01) | OAuth client of type **Desktop app** in Google Cloud Console. Read only in the main process. |
| `MAIN_VITE_GOOGLE_CLIENT_SECRET` | Google token exchange | Google still requires it for Desktop clients, but it ships inside the app and **is not truly secret**. Security comes from PKCE + loopback redirect. Kept out of git anyway. |
| `GH_TOKEN` | Publishing releases (CI only) | Lets electron-builder upload to the public releases repo. |
| `CSC_LINK`, `CSC_KEY_PASSWORD` | macOS code signing (CI only) | Developer ID certificate. |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | macOS notarization (CI only) | Required for auto-update on macOS. |
| `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` | Windows code signing (CI only) | Removes SmartScreen warnings. |
| `EXTROVERT_PROFILE_DIR` | Dev/tests only | Points the app at a throwaway data folder, so E2E tests never touch real logins. Ignored in packaged builds. |

**Google Cloud setup (one time):** create a project → OAuth consent screen (External; scopes `openid email profile`, which are non-sensitive and need no Google verification) → create a **Desktop app** OAuth client. Desktop clients accept any `http://127.0.0.1:<port>` loopback redirect, so there is nothing to register. While the consent screen is in *Testing* mode, only listed test users can sign in and their sign-ins expire after 7 days, so switch it to *In production* before release. Adding `drive.appdata` for sync (FR-W08) means re-checking the consent screen at that point.

**Configuration in code** (reviewed in PRs, covered by unit tests):

| File | Controls |
|---|---|
| `src/core/services/catalog.ts` | Every built-in service: URL, domains, unread rule, login-page patterns, kind (feed/chat/mail). |
| `src/core/settings/defaults.ts` + `schema.ts` | Default value and validation for every user setting (DND, digest interval, budgets, retention…), plus versioned migrations. |
| `src/shared/config.ts` | App constants: user-agent string, update check interval (6 h), idle threshold (60 s), memory-pressure threshold, startup load order. |
| `src/shared/features.ts` | Feature flags for "Could"/beta features (people view, proxy, tracker blocking). Enabled automatically on the beta channel. |
| `electron-builder.yml` | App ID, product name, icons, signing, update feed (GitHub owner/repo). |

**Runtime user settings** live in `electron-store` and are only changed through the Settings UI, always validated against the schema. Tokens are stored separately with `safeStorage`.

Not planned: remote config downloaded at runtime. Catalog fixes (e.g. a changed Messenger URL) ship as a normal update, which keeps the "no server" promise.

## 8. Code Organisation & Modularity

### 8.1 Principles
1. **Layered, with one-way dependencies:**
   `shared` ← `core` ← `main` / `preload` / `renderer`
   - **`core`** is pure TypeScript domain logic with **zero imports from `electron`, `react`, or Node I/O**. Everything that matters (unread parsing, URL routing, workspace rules, aggregation, catalog validation) lives here, so all of it is unit-testable.
   - **`main`** contains thin adapters that wire `core` to Electron APIs. It holds no business logic.
   - **`renderer`** is UI only. It talks to `main` through the typed IPC contract.
   - The ESLint rule `import/no-restricted-paths` enforces these boundaries, so a violation fails CI.
2. **Feature folders:** each feature (workspaces, services, notifications, auth, sync, settings) owns its code across layers, which keeps related code together.
3. **One typed IPC contract** in `shared/ipc.ts`. Channel names and payload types are defined once, and both sides use them, with no magic strings.
4. **Small units:** a file does one thing. Aim for under ~200 lines per file and under ~40 lines per function, and split when a file grows past that.
5. **Strict TypeScript:** `strict: true`, `noUncheckedIndexedAccess`, and no `any` (lint error).
6. **Naming:** `kebab-case` files, `PascalCase` components/types, `camelCase` functions. Tests sit next to their code as `*.test.ts`.
7. **Docs:** short README per top-level folder explaining its role. Comments explain *why*, not *what*.
8. **Commits:** Conventional Commits (`feat:`, `fix:`, …), with lint-staged + Husky pre-commit running format, lint, and related tests.

### 8.2 Folder structure
```
extrovert/
├─ PLANNING.md
├─ package.json
├─ electron.vite.config.ts
├─ electron-builder.yml
├─ .github/workflows/ci.yml
├─ src/
│  ├─ shared/                 # types + IPC contract (no runtime deps)
│  │  ├─ ipc.ts
│  │  └─ types.ts
│  ├─ core/                   # pure logic, 100% unit-testable
│  │  ├─ services/            # catalog, validation, custom-url parsing
│  │  ├─ unread/              # title parser, aggregator
│  │  ├─ routing/             # internal vs external link decision
│  │  ├─ workspaces/          # workspace model, partition naming, rules
│  │  ├─ notifications/       # history, DND rules, filters
│  │  ├─ attention/           # VIP, digest, snooze, recap, next-unread rules
│  │  ├─ usage/               # time tracking, budgets, feed guard
│  │  └─ settings/            # schema, defaults, migrations
│  ├─ main/                   # Electron adapters (thin)
│  │  ├─ app.ts               # entry: wires managers together
│  │  ├─ auth/                # Google OAuth PKCE loopback, safeStorage
│  │  ├─ views/               # ViewManager
│  │  ├─ workspaces/          # WorkspaceManager
│  │  ├─ notifications/       # NotificationBridge, dock badge
│  │  ├─ sync/                # Drive appdata
│  │  ├─ ipc/                 # handlers bound to shared/ipc.ts
│  │  └─ window/              # BaseWindow, menu, tray, shortcuts
│  ├─ preload/
│  │  ├─ shell.ts             # exposes typed API to renderer
│  │  └─ service.ts           # Notification wrapper only
│  └─ renderer/
│     ├─ app/                 # root, providers, routing
│     ├─ features/
│     │  ├─ workspace-switcher/
│     │  ├─ sidebar/
│     │  ├─ onboarding/
│     │  ├─ notification-center/
│     │  ├─ command-palette/
│     │  └─ settings/
│     ├─ components/          # shared UI primitives (Button, Badge, Avatar…)
│     ├─ hooks/
│     ├─ i18n/                # translation files (en first)
│     └─ styles/
├─ tests/
│  ├─ e2e/                    # Playwright Electron
│  └─ fixtures/               # local fake service pages
└─ resources/                 # app + service icons
```

---

## 9. Testing Strategy

**Rule:** no feature or bug fix merges without tests. Every bug fix includes a regression test that fails before the fix.

| Level | Tool | What | Target |
|---|---|---|---|
| **Unit: core** | Vitest | All of `src/core`: title parsing (`(3) Facebook`, `(99+) …`, no count), URL routing (internal/external/popups), partition naming, unread aggregation across instances and workspaces, DND rules, catalog and custom-URL validation, settings migrations, digest batching, VIP matching, snooze timing, next-unread ordering, login-URL detection, usage budgets | **≥ 90 %** line + branch coverage |
| **Unit: main adapters** | Vitest + `vi.mock('electron')` | ViewManager show/hide/bounds, AuthManager token flow (mocked HTTP), IPC handlers validate input and reject bad senders | ≥ 75 % |
| **Unit: renderer** | Vitest + React Testing Library | Badge rendering (0 / n / 99+ / dot / paused), workspace switch click, sidebar keyboard nav, settings forms, palette fuzzy search | ≥ 75 % |
| **E2E smoke** | Playwright for Electron | Launch app → add a **local fixture service** (a test page that sets `document.title = "(3) Test"` and fires a `Notification`) → assert sidebar badge = 3, workspace badge = 3, and a notification-center entry exists → switch workspace → restart → state persisted | Critical paths. Deterministic, never hits real Facebook. |
| **Manual checklist** | Markdown in `tests/manual.md` | Real logins on each platform before every release (bot detection, 2FA, calls) | Each release |

**CI gate** (GitHub Actions, macOS + Windows + Linux): `typecheck` → `lint` → `test --coverage` (fails below thresholds) → `e2e` → `build`. Every PR must pass all steps.

---

## 10. What Extrovert adds over Ferdium & Rambox

See [COMPETITIVE_ANALYSIS.md](COMPETITIVE_ANALYSIS.md), the publishable comparison. The features it promises map to FR-A03, A04, A05, A07, A08, FR-W01–W05, W08, FR-N04, N06, FR-S06, and NFR-10.

---

## 11. Delivery Plan

| Phase | Deliverable | Exit criteria |
|---|---|---|
| **0. Feasibility spike** | Bare Electron app: all built-in services with Chrome UA + partitions, and a Google OAuth loopback test | All 5 social services + Gmail log in and survive a restart. WhatsApp shows its QR code. **Google sign-in works inside the Gmail view** (biggest risk, see §12). Title counts verified per service. |
| **1. Foundation** | Repo scaffold, folder layout, lint/format, strict TS, layer-boundary rule, i18n setup (FR-X30), Vitest + coverage gates, Playwright harness, CI matrix | An empty app builds and the CI pipeline passes on all 3 OSes |
| **2. Core shell** | `core` modules (TDD), ViewManager, staggered startup (FR-X16), sidebar, service switching, shortcuts, find-in-page, link routing, service states | FR-N01–N05, FR-S01, S04–S08 pass, with core coverage ≥ 90 % |
| **3. Accounts & workspaces** | Google sign-in, workspace switcher, isolated partitions, token encryption, sign-out | FR-W01–W07 pass |
| **4. Notifications** | Unread pipeline, service and workspace badges, dock badge, native notifications, notification center, jump to next unread, login watchdog, auto-recover | FR-A01–A07, FR-X01–X02, X17 pass, with the E2E fixture test green |
| **5. Extensibility & settings** | Catalog picker, custom URL services, multiple instances, settings panel, theme, export/import | FR-S02, S03, FR-P01–P05 pass |
| **6. Polish** | Command palette, context menu, zoom, DND, hibernation, suspended workspaces, badge health, Drive sync, a11y pass | "S" items done, UX review |
| **7. Signature & market features** | FR-X01, X02, X16, X17, X30 (the M items) land in earlier phases. This phase covers the rest: attention (snooze, VIP, digest, recap), flow (peek, call bubble), privacy (media indicator, share shield, blur), wellbeing (time insights, feed guard), performance (smart hibernation, task manager, no autoplay), productivity (smart links, pins, saved replies, zen mode, tray view, downloads), trust (Ferdium import, permissions dashboard), growth (what's new, beta channel) | All FR-X "S" items pass, with each rule engine at ≥ 90 % coverage in `core` |
| **8. Ship** | Signed builds for all 3 OSes, notarization, auto-update | v1.0.0 → v1.0.1 auto-update works on each OS |

---

## 11b. Build status (2026-10-10)

The app is built end to end in `src/` and runs with `pnpm dev`. Checks: `pnpm test` (118 unit tests), `pnpm typecheck`, `pnpm test:e2e` (29 end-to-end checks against a real Electron instance with a local fixture service).

**Working:** Google sign-in (system browser, PKCE) · one workspace per Google account with the Gmail-style account menu · logins isolated per workspace, shared where a platform shares them (one Google sign-in for Gmail, Calendar, Drive, Meet and Chat; one Meta login for Facebook and Messenger; a second account of an app keeps its own) · add several services at once · Google apps always open as the workspace's own Google account (a browser can hold several) · grouped multi-account services with tags · outline brand icons from the Tabler icon pack (instant, offline; custom websites use their own site icon) · unread badges from page titles, per workspace and on the dock/tray · the services' own notifications shown natively with previews, history, VIPs, DND, digest, work hours, snooze that reopens the exact chat, away recap, people view · sign-in detection from each platform's own login cookie, with the login watchdog and a "Sign in with <your browser>" offer on signed-out services · smart link routing, pins, saved replies, find, zoom, zen, command palette · peek · call bubble, camera/mic/screen indicators, screen picker, screen-share shield · permission prompts and dashboard · lock with PIN/Touch ID and panic key · time insights and feed guard · staggered startup, auto-recover, smart hibernation, task manager · downloads · tray mini view · Ferdium import, config export/import, sign in with your browser (macOS) · updates from GitHub Releases · onboarding.

**Changed from the plan:** plain CSS ported from the approved prototype instead of Tailwind; small JSON files (atomic writes) instead of electron-store, which is ESM-only.

**Not built yet:** Drive sync (FR-W08) · tracker blocking (FR-X29) · translation files (FR-X30: strings are still in components) · ESLint/Prettier and the CI pipeline (Phase 1) · installers via electron-builder (Phase 8) · browser-login import on Windows/Linux and from Firefox/Safari · notifications a service sends from its service worker while its page is closed.

**Known limits:** Tabler has no brand outline for Google Calendar, Meet or Chat, so those use matching outline icons (calendar, video, chat bubbles) in their Google colors.

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Google blocks sign-in inside embedded browsers** ("This browser or app may not be secure"), which affects the Gmail/Google app views | High | A clean Chrome UA without the `Electron` token usually passes. Phase 0 validates it. Fallback: show Google apps with a "sign in once in browser" help flow, or defer Google apps to v1.1. The **Extrovert** sign-in itself is unaffected because it uses the system browser. |
| Meta/LinkedIn/WhatsApp detect Electron and degrade or block it | High | Chrome UA, validated in Phase 0. Ferdium and Rambox prove this works today. |
| messenger.com retirement or URL changes | Medium | The URL lives in the catalog and can be overridden per instance. |
| Passkey/WebAuthn login gaps in Electron | Medium | Fall back to password + 2FA code, documented in onboarding. |
| Title format changes break counts | Medium | Notification hook as a second signal, the badge health indicator, and selector fallbacks in the catalog. |
| RAM with many workspaces × services | Medium | Hibernation, suspending inactive workspaces, and a memory view. |
| Code signing cost/setup (Apple Developer ID, Windows cert) | Medium | Unsigned dev builds until Phase 8. Budget for certificates. |
| Snooze-to-chat loses the original notification after a page reload | Low | Fall back to opening the service, and tell the user in the snooze card. |
| Call UIs may render poorly at call-bubble size | Medium | Minimum bubble size, and the user can resize it. Validate each calling service in the manual checklist. |
| Sender-name matching (VIP, people view) is ambiguous: same name, or a different name per platform | Medium | Exact match plus user-defined aliases. People-view links are always confirmed by the user, never guessed. |
| Feed guard feels naggy | Low | Off by default, fully configurable, never applied to messaging. |
| Google OAuth app verification for `drive.appdata` scope | Low | Sync is "S" priority. Identity-only scopes don't need verification. |
| ToS concerns | Low | The app is a browser: no automation, scraping, or private API use. |

---

## 13. Next Step

**Phase 0, the feasibility spike.** Load every built-in service in Electron, log in, restart, verify persistence and title counts, and test Google sign-in inside the Gmail view. Then do Phase 1 (scaffold + CI + test harness) before writing any feature code.
