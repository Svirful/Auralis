import React from 'react';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
import './stats-tab.scss';

function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}


export default function StatsTab() {
  const { sessionElapsedSeconds, connected } = useLiveAPIContext();

  return (
    <div className="stats-tab">
      <div className="stats-grid">
        {/* Session Timer */}
        <div className="stats-card stats-card-primary">
          <div className="stats-card-header">
            <span className="material-symbols-outlined stats-icon">timer</span>
            <span className="stats-label">Current Session</span>
          </div>
          <div className="stats-value-container">
            <span className="stats-value">{formatTime(sessionElapsedSeconds)}</span>
          </div>
          <div className="stats-status">
            <span className={`status-dot ${connected ? 'active' : 'inactive'}`} />
            <span className="status-text">
              {connected ? 'Session active' : 'No active session'}
            </span>
          </div>
        </div>

        {/* Info Card */}
        <div className="stats-card stats-card-info">
          <div className="stats-card-header">
            <span className="material-symbols-outlined stats-icon">info</span>
            <span className="stats-label">How it works</span>
          </div>
          <p className="stats-description">
            Voice and vision time are tracked separately.
            Vision time is counted whenever screen share or webcam is active.
            Usage is billed directly to your Gemini API key — check your quota at{' '}
            <button
              className="inline-link"
              onClick={() => {
                const electron = (window as any).electron;
                if (electron?.openExternal) {
                  electron.openExternal('https://aistudio.google.com/app/apikey');
                } else {
                  window.open('https://aistudio.google.com/app/apikey', '_blank');
                }
              }}
            >
              Google AI Studio
            </button>.
          </p>
        </div>
      </div>
    </div>
  );
}
