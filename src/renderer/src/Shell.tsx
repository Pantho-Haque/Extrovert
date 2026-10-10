import { useCallback, useEffect, useState } from 'react';
import type { AppSnapshot } from '../../shared/ipc';
import { AccountMenu } from './AccountMenu';
import { AddService } from './AddService';
import { BrowserImport } from './BrowserImport';
import { Downloads } from './Downloads';
import { Guide, Tour } from './Guide';
import { Insights, TaskManager } from './Insights';
import { instanceName } from '../../core/workspaces/model';
import { act, api, isMac } from './lib';
import { MainArea, pageVisible } from './MainArea';
import { NotificationCenter } from './NotificationCenter';
import { Onboarding } from './Onboarding';
import { Palette } from './Palette';
import { ReportProblem } from './ReportProblem';
import { FeedGuard, LockScreen, PermissionPrompt, Recap, ScreenPicker, SigningIn, WhatsNew } from './RuntimeOverlays';
import { Settings, type SectionId } from './Settings';
import { Sidebar } from './Sidebar';

export type Overlay =
  | { kind: 'account' }
  | { kind: 'addService' }
  | { kind: 'settings'; section?: SectionId }
  | { kind: 'palette'; mode: 'commands' | 'replies' }
  | { kind: 'notifications'; tab?: 'all' | 'people' | 'snoozed' }
  | { kind: 'insights' }
  | { kind: 'taskManager' }
  | { kind: 'downloads' }
  | { kind: 'browserImport' }
  | { kind: 'feedback' }
  | { kind: 'guide' }
  | { kind: 'tour' };

export function Shell({ snap }: { snap: AppSnapshot }) {
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [onboarding, setOnboarding] = useState(snap.workspaces.length === 0);
  const close = useCallback(() => setOverlay(null), []);
  const rt = snap.runtime;
  const ws = snap.workspaces.find((w) => w.id === snap.activeWorkspaceId) ?? snap.workspaces[0];
  const needsOnboarding = onboarding || snap.workspaces.length === 0;

  // Menu shortcuts arrive as commands from main.
  useEffect(
    () =>
      api.onCommand((cmd) => {
        const map: Record<string, Overlay> = {
          palette: { kind: 'palette', mode: 'commands' }, replies: { kind: 'palette', mode: 'replies' }, settings: { kind: 'settings' },
          notifications: { kind: 'notifications' }, accountMenu: { kind: 'account' }, addService: { kind: 'addService' },
          insights: { kind: 'insights' }, taskManager: { kind: 'taskManager' }, browserImport: { kind: 'browserImport' },
          guide: { kind: 'guide' }, tour: { kind: 'tour' }, feedback: { kind: 'feedback' },
        };
        if (map[cmd]) setOverlay(map[cmd]);
      }),
    [],
  );

  // First time in the app (right after onboarding): a quick tour of every feature.
  const tourDue = !snap.settings.tourDone && !!ws && !needsOnboarding;
  useEffect(() => {
    if (tourDue) setOverlay((o) => o ?? { kind: 'tour' });
  }, [tourDue]);

  useEffect(() => {
    const on = () => act('setOnline', { online: true });
    const off = () => act('setOnline', { online: false });
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Anything drawn over the service area needs the shell raised above the live page.
  const runtimeOverlay = rt.locked || !!rt.permissionPrompt || !!rt.screenPicker || !!rt.feedGuard || !!rt.recap || !!rt.whatsNew || rt.signingIn;
  const raised = !!overlay || runtimeOverlay || needsOnboarding;
  useEffect(() => {
    void act('setOverlay', { open: raised });
  }, [raised]);

  const opaque = !ws || !pageVisible(snap, ws);

  const activeInst = ws && (ws.instances.find((i) => i.id === ws.activeInstanceId) ?? ws.instances[0]);
  return (
    <div className="app">
      {isMac && (
        // Thin title bar: holds the window buttons and drags the window. Nothing sits under the buttons.
        <header className="titlebar">
          {ws && !needsOnboarding && <span>{activeInst ? `${instanceName(activeInst)} · ` : ''}{ws.name}</span>}
        </header>
      )}
      <div className="app-row">
        {ws && !needsOnboarding && !rt.zen && <Sidebar snap={snap} ws={ws} onOpen={setOverlay} />}
        <main className={`main ${opaque ? 'opaque' : ''}`}>
          {ws && !needsOnboarding && opaque && <MainArea snap={snap} ws={ws} onOpen={setOverlay} />}
        </main>
      </div>

      {overlay?.kind === 'account' && ws && <AccountMenu snap={snap} ws={ws} onClose={close} onOpen={setOverlay} />}
      {overlay?.kind === 'addService' && ws && <AddService snap={snap} ws={ws} onClose={close} onOpen={setOverlay} />}
      {overlay?.kind === 'settings' && <Settings snap={snap} section={overlay.section} onClose={close} onOpen={setOverlay} />}
      {overlay?.kind === 'palette' && ws && <Palette snap={snap} ws={ws} mode={overlay.mode} onClose={close} onOpen={setOverlay} />}
      {overlay?.kind === 'notifications' && <NotificationCenter snap={snap} initialTab={overlay.tab} onClose={close} />}
      {overlay?.kind === 'insights' && <Insights snap={snap} onClose={close} />}
      {overlay?.kind === 'taskManager' && <TaskManager snap={snap} onClose={close} />}
      {overlay?.kind === 'downloads' && <Downloads snap={snap} onClose={close} />}
      {overlay?.kind === 'browserImport' && ws && <BrowserImport snap={snap} ws={ws} onClose={close} />}
      {overlay?.kind === 'feedback' && <ReportProblem snap={snap} onClose={close} />}
      {overlay?.kind === 'guide' && <Guide onClose={close} onTour={() => setOverlay({ kind: 'tour' })} onReport={() => setOverlay({ kind: 'feedback' })} />}
      {overlay?.kind === 'tour' && <Tour onClose={close} />}

      {rt.recap && <Recap snap={snap} />}
      {rt.whatsNew && !rt.recap && <WhatsNew snap={snap} onFeedback={() => setOverlay({ kind: 'feedback' })} />}
      {rt.feedGuard && <FeedGuard snap={snap} />}
      {rt.signingIn && !needsOnboarding && <SigningIn />}
      {rt.screenPicker && <ScreenPicker snap={snap} />}
      {rt.permissionPrompt && <PermissionPrompt snap={snap} />}
      {needsOnboarding && <Onboarding snap={snap} onDone={() => setOnboarding(false)} onStart={() => setOnboarding(true)} />}
      {rt.locked && <LockScreen snap={snap} />}
    </div>
  );
}
