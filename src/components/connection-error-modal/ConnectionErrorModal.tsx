import React from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import "./connection-error-modal.scss";

export const ConnectionErrorModal: React.FC = () => {
  const { connectionError, clearConnectionError } = useLiveAPIContext();

  if (!connectionError) return null;

  // Handle opening settings - we can dispatch a custom event that SettingsDialog might listen to,
  // or simply rely on the user closing this and clicking settings.
  // For a premium feel, let's just make it a beautiful informative modal.
  
  const handleSettingsClick = () => {
    // Dispatch a custom event to open settings
    const event = new CustomEvent("open-settings");
    window.dispatchEvent(event);
    clearConnectionError();
  };

  return (
    <div className="connection-error-overlay" onClick={clearConnectionError}>
      <div className="connection-error-modal" onClick={(e) => e.stopPropagation()}>
        <div className="error-icon material-symbols-outlined">
          signal_disconnected
        </div>
        <h2>Connection Failed</h2>
        <p>{connectionError}</p>
        <div className="modal-actions">
          <button className="close-btn" onClick={clearConnectionError}>
            <span className="material-symbols-outlined">close</span>
            Dismiss
          </button>
          <button className="settings-btn" onClick={handleSettingsClick}>
            <span className="material-symbols-outlined">settings</span>
            Open Settings
          </button>
        </div>
      </div>
    </div>
  );
};
