import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { CH, type AppSnapshot, type ExtrovertApi, type ShellCommand } from '../shared/ipc';

const api: ExtrovertApi = {
  platform: process.platform,
  getState: () => ipcRenderer.invoke(CH.getState),
  onState: (listener) => {
    const handler = (_e: IpcRendererEvent, state: AppSnapshot) => listener(state);
    ipcRenderer.on(CH.state, handler);
    return () => ipcRenderer.removeListener(CH.state, handler);
  },
  onCommand: (listener) => {
    const handler = (_e: IpcRendererEvent, cmd: ShellCommand) => listener(cmd);
    ipcRenderer.on(CH.command, handler);
    return () => ipcRenderer.removeListener(CH.command, handler);
  },
  do: (action, ...payload) => ipcRenderer.invoke(CH.action, action, payload[0]),
};

contextBridge.exposeInMainWorld('extrovert', api);
