/**
 * App menu with every keyboard shortcut (FR-N04 and friends). Menu accelerators work even while a
 * service page has focus. The Edit roles are what make copy/paste work inside services on macOS.
 */
import { Menu, type MenuItemConstructorOptions } from 'electron';
import { instanceName, orderedInstances } from '../core/workspaces/model';
import type { Extrovert } from './app';

export function buildMenu(app: Extrovert): void {
  const ws = app.store.activeWorkspace;
  const services = ws ? orderedInstances(ws.instances).slice(0, 9) : [];
  const active = () => app.activeInstance();
  const withActive = (fn: (id: string, wsId: string) => void) => () => {
    const inst = active();
    const w = app.store.activeWorkspace;
    if (inst && w) fn(inst.id, w.id);
  };

  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [{
          label: 'Extrovert',
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => app.command('settings') },
            { type: 'separator' },
            { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        } as MenuItemConstructorOptions]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'Add Service…', accelerator: 'CmdOrCtrl+N', click: () => app.command('addService') },
        { label: 'Add Google Account…', click: () => void app.signIn() },
        { type: 'separator' },
        { label: 'Lock Extrovert', accelerator: 'CmdOrCtrl+Shift+L', click: () => void app.lock() },
        ...(process.platform !== 'darwin' ? [{ type: 'separator' } as const, { label: 'Settings…', accelerator: 'Ctrl+,', click: () => app.command('settings') }, { role: 'quit' } as const] : [{ type: 'separator' } as const, { role: 'close' } as const]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'pasteAndMatchStyle' }, { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find in Page…', accelerator: 'CmdOrCtrl+F', click: () => app.command('find') },
        { label: 'Saved Replies…', accelerator: 'CmdOrCtrl+Shift+V', click: () => app.command('replies') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Command Palette…', accelerator: 'CmdOrCtrl+K', click: () => app.command('palette') },
        { label: 'Notifications', accelerator: 'CmdOrCtrl+Shift+N', click: () => app.command('notifications') },
        { label: 'Time Insights', click: () => app.command('insights') },
        { label: 'Task Manager', click: () => app.command('taskManager') },
        { type: 'separator' },
        { label: 'Zen Mode', accelerator: 'CmdOrCtrl+\\', click: () => app.toggleZen() },
        { label: 'Reload Service', accelerator: 'CmdOrCtrl+R', click: () => app.reload() },
        { label: 'Back', accelerator: 'CmdOrCtrl+[', click: withActive((id) => app.views.webContents(id)?.navigationHistory.goBack()) },
        { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: withActive((id) => app.views.webContents(id)?.navigationHistory.goForward()) },
        { type: 'separator' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: withActive((id) => app.setZoom(id, 10)) },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: withActive((id) => app.setZoom(id, -10)) },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', click: withActive((id) => app.setZoom(id, 0)) },
        { type: 'separator' },
        { label: 'Service Developer Tools', accelerator: 'Alt+CmdOrCtrl+I', click: withActive((id) => app.views.webContents(id)?.openDevTools({ mode: 'detach' })) },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Go',
      submenu: [
        { label: 'Next Unread', accelerator: 'CmdOrCtrl+J', click: () => app.goNextUnread() },
        { label: 'Switch Account…', click: () => app.command('accountMenu') },
        { type: 'separator' },
        ...services.map((inst, k): MenuItemConstructorOptions => ({ label: instanceName(inst), accelerator: `CmdOrCtrl+${k + 1}`, click: () => ws && app.selectInstance(ws.id, inst.id) })),
        { type: 'separator' },
        ...app.store.workspaces.slice(0, 9).map((w, k): MenuItemConstructorOptions => ({ label: `${w.name} (${w.email})`, accelerator: `CmdOrCtrl+Shift+${k + 1}`, click: () => app.selectWorkspace(w.id) })),
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
