/** Every download from every service in one list (FR-X26). */
import { instanceName } from '../../core/workspaces/model';
import type { AppSnapshot } from '../../shared/ipc';
import { Icon } from './icons';
import { act, findInstance, timeAgo } from './lib';
import { ServiceIcon, useEscape } from './ui';

const size = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

export function Downloads({ snap, onClose }: { snap: AppSnapshot; onClose: () => void }) {
  useEscape(onClose);
  return (
    <>
      <div className="click-away" onMouseDown={onClose} />
      <div className="popover" style={{ left: 78, bottom: 60 }}>
        <div className="pop-h"><b>Downloads</b>{snap.downloads.length > 0 && <button className="linkish" onClick={() => act('clearDownloads')}>Clear</button>}</div>
        <div style={{ padding: '0 8px 8px', maxHeight: 420, overflow: 'auto' }}>
          {snap.downloads.length === 0 && <p className="empty">Files you download from any service show up here.</p>}
          {snap.downloads.map((d) => {
            const loc = findInstance(snap, d.instanceId);
            const status = d.state === 'progressing' ? `${size(d.received)} of ${size(d.bytes)}` : d.state === 'completed' ? size(d.bytes) : d.state === 'cancelled' ? 'Cancelled' : 'Failed';
            return (
              <div key={d.id} className="dl" onDoubleClick={() => d.state === 'completed' && act('openDownload', { id: d.id, reveal: false })}>
                <Icon name="file" size={22} />
                <div>
                  <b>{d.name}</b>
                  <small>{status} · {loc && <><ServiceIcon type={loc.inst.type} look={loc.inst} name={instanceName(loc.inst)} status={snap.statuses[loc.inst.id]} size={12} /> {instanceName(loc.inst)} · {loc.ws.name} ·</>} {timeAgo(d.at)}</small>
                </div>
                {d.state === 'completed' && (
                  <>
                    <button className="icon-btn" title="Open" onClick={() => act('openDownload', { id: d.id, reveal: false })}><Icon name="file" size={15} /></button>
                    <button className="icon-btn" title="Show in folder" onClick={() => act('openDownload', { id: d.id, reveal: true })}><Icon name="folder" size={15} /></button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
