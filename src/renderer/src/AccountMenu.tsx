/** Gmail-style account menu (FR-W04): current account, every other account with its unread count, add, sign out. */
import { useState } from 'react';
import { workspaceUnread } from '../../core/unread/aggregate';
import type { AppSnapshot } from '../../shared/ipc';
import type { Workspace } from '../../shared/types';
import { Icon } from './icons';
import { act, isMac } from './lib';
import type { Overlay } from './Shell';
import { Avatar, useEscape } from './ui';

export function AccountMenu({ snap, ws, onClose, onOpen }: { snap: AppSnapshot; ws: Workspace; onClose: () => void; onOpen: (o: Overlay) => void }) {
  useEscape(onClose);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const rt = snap.runtime;
  const others = snap.workspaces.filter((w) => w.id !== ws.id);

  return (
    <>
      <div className="click-away" onMouseDown={onClose} />
      <div className="popover" role="menu" style={{ left: 78, top: isMac ? 36 : 8 }}>
        <div className="acct-cur">
          <small>{ws.email}</small>
          <Avatar ws={ws} size={64} />
          <b>Hi, {ws.name}!</b>
          <button className="btn sm" onClick={() => onOpen({ kind: 'settings', section: 'account' })}>Manage this workspace</button>
        </div>
        <div className={`acct-list ${rt.sharing && snap.settings.shareShield ? 'shielded' : ''}`}>
          {others.map((w) => {
            const n = workspaceUnread(w, snap.statuses);
            return (
              <button key={w.id} className="acct-row" role="menuitem" onClick={() => { onClose(); void act('selectWorkspace', { workspaceId: w.id }); }}>
                <Avatar ws={w} size={34} />
                <span className="acct-txt">
                  <b>{w.name}</b>
                  <small>{w.email}</small>
                  {rt.outsideHours[w.id] ? <small className="acct-flag"><Icon name="moon" size={11} /> Outside work hours</small>
                    : w.suspended ? <small className="acct-flag"><Icon name="clock" size={11} /> Paused</small> : null}
                </span>
                {n > 0 && <em className={`badge inline ${w.suspended ? 'grey' : ''}`}>{n > 99 ? '99+' : n}</em>}
              </button>
            );
          })}
          <button className="acct-row add" role="menuitem" disabled={rt.signingIn} onClick={() => { onClose(); void act('signIn'); }}>
            <span className="acct-plus"><Icon name="plus" /></span>
            <span className="acct-txt"><b>Add another account</b><small>Each Google account gets its own workspace</small></span>
          </button>
        </div>
        {confirmSignOut ? (
          <div className="acct-confirm">
            <b>Sign out of {ws.email}?</b>
            <small>This also signs you out of every service in this workspace and deletes their logins and data from this computer.</small>
            <div className="row">
              <button className="btn sm" onClick={() => setConfirmSignOut(false)}>Cancel</button>
              <button className="btn sm danger-t" onClick={() => { onClose(); void act('signOut', { workspaceId: ws.id }); }}>Sign out</button>
            </div>
          </div>
        ) : (
          <div className="acct-foot">
            <button className="linkish" onClick={() => setConfirmSignOut(true)}><Icon name="logout" size={14} /> Sign out of {ws.name}</button>
            <small>{isMac ? '⌘⇧' : 'Ctrl+Shift+'}1–9</small>
          </div>
        )}
      </div>
    </>
  );
}
