import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { getPendingRequests, subscribeToRequests } from '../../api/requestActivity';
import loadingGif from '../../GIF/output-onlinegiftools.gif';
import './GlobalLoader.css';

export function LoadingOverlay() {
  return createPortal(
    <div className="global-loading-overlay" role="status" aria-live="polite" aria-label="Loading, please wait" aria-busy="true">
      <div className="global-loading-content">
        <img src={loadingGif} alt="" className="global-loading-gif" />
        <p>Loading... Please wait</p>
      </div>
    </div>,
    document.body,
  );
}

export default function GlobalLoader() {
  const pending = useSyncExternalStore(subscribeToRequests, getPendingRequests, () => 0);
  return pending > 0 ? <LoadingOverlay /> : null;
}
