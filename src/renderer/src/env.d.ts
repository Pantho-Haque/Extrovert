/// <reference types="vite/client" />
import type { ExtrovertApi } from '../../shared/ipc';

declare global {
  interface Window {
    extrovert: ExtrovertApi;
  }
}
