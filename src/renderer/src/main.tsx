import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useSnapshot, useTheme } from './lib';
import { FindPanel, PeekPanel, ToastsPanel, TrayPanel } from './Panels';
import { Shell } from './Shell';
import './styles.css';

/** One bundle, several surfaces: the hash says which one this window/view is. */
const surface = location.hash.slice(1);

function Root() {
  const snap = useSnapshot();
  useTheme(snap?.settings.theme);
  if (!snap) return null;
  switch (surface) {
    case 'toasts': return <ToastsPanel snap={snap} />;
    case 'find': return <FindPanel snap={snap} />;
    case 'peek': return <PeekPanel snap={snap} />;
    case 'tray': return <TrayPanel snap={snap} />;
    default: return <Shell snap={snap} />;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
