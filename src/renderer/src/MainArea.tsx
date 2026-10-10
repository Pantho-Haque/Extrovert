/**
 * What fills the space right of the sidebar when no service page is showing: paused, sleeping,
 * signed out, offline, crashed, call in the bubble, or an empty workspace.
 */
import { instanceName, orderedInstances } from '../../core/workspaces/model';
import type { AppSnapshot } from '../../shared/ipc';
import type { Workspace } from '../../shared/types';
import { act } from './lib';
import type { Overlay } from './Shell';
import { StateCard } from './ui';

/** True when the active service's own page is on screen (the shell then stays transparent there). */
export function pageVisible(snap: AppSnapshot, ws: Workspace | undefined): boolean {
  if (!ws || ws.suspended) return false;
  const list = orderedInstances(ws.instances);
  const inst = list.find((i) => i.id === ws.activeInstanceId) ?? list[0];
  const st = inst && snap.statuses[inst.id];
  if (!inst || !st) return false;
  if (snap.runtime.call?.inBubble && snap.runtime.call.instanceId === inst.id) return false;
  return st.state === 'live' || st.state === 'loading';
}

export function MainArea({ snap, ws, onOpen }: { snap: AppSnapshot; ws: Workspace; onOpen: (o: Overlay) => void }) {
  const list = orderedInstances(ws.instances);
  const inst = list.find((i) => i.id === ws.activeInstanceId) ?? list[0];
  const ref = inst && { workspaceId: ws.id, instanceId: inst.id };

  if (ws.suspended) {
    return (
      <StateCard icon="clock" title={`${ws.name} is paused`} text="Paused workspaces don't run in the background, to save memory. Its services load again when you resume it.">
        <button className="btn primary" onClick={() => act('updateWorkspace', { workspaceId: ws.id, patch: { suspended: false } })}>Resume workspace</button>
      </StateCard>
    );
  }
  if (!inst || !ref) {
    return (
      <StateCard icon="plus" title={`Add your first service to ${ws.name}`} text="Facebook, WhatsApp, Instagram, LinkedIn, Gmail, or any website by its address. Each one keeps its own login.">
        <button className="btn primary" onClick={() => onOpen({ kind: 'addService' })}>Add a service</button>
      </StateCard>
    );
  }
  const st = snap.statuses[inst.id];
  const name = instanceName(inst);
  if (snap.runtime.call?.inBubble && snap.runtime.call.instanceId === inst.id) {
    return (
      <StateCard icon="phone" title={`Your ${name} call is in the floating window`} text="It stays on top while you use other services.">
        <button className="btn primary" onClick={() => act('returnToCall')}>Bring the call back here</button>
      </StateCard>
    );
  }
  switch (st?.state) {
    case 'sleeping':
      return (
        <StateCard icon="moon" title={`${name} is sleeping`} text="It was put to sleep to free memory. Messaging apps stay awake.">
          <button className="btn primary" onClick={() => act('wake', ref)}>Wake up</button>
        </StateCard>
      );
    case 'signedout':
      return (
        <StateCard icon="alert" tone="warn" title={`You've been signed out of ${name}`} text="Extrovert noticed this service went back to its login page, so you'd have silently missed notifications. Sign in again to get them back.">
          <button className="btn primary" onClick={() => act('signInAgain', ref)}>Sign in again</button>
          {snap.platform === 'darwin' && <button className="btn" onClick={() => onOpen({ kind: 'browserImport' })}>Use my browser's login</button>}
        </StateCard>
      );
    case 'syncing':
      return (
        <StateCard icon="refresh" title={`Reconnecting ${name}…`} text={`Its login expired here, so Extrovert is copying it again from ${ws.loginSources?.[inst.session]?.browserName ?? 'your browser'}. If macOS asks for access, choose "Always Allow" so it happens silently next time.`}>
          <div className="spinner" />
        </StateCard>
      );
    case 'offline':
      return (
        <StateCard icon="wifi" title="You're offline" text={`${name} reloads automatically when the connection is back.`}>
          <button className="btn primary" onClick={() => act('reload', ref)}>Retry now</button>
        </StateCard>
      );
    case 'crashed':
      return (
        <StateCard icon="zap" tone="warn" title={`${name} couldn't load`} text={<>Only this service was affected; everything else is still running.{st.error && <small>{st.error}</small>}</>}>
          <button className="btn primary" onClick={() => act('reload', ref)}>Reload</button>
        </StateCard>
      );
    default:
      return null;
  }
}
