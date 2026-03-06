/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import SettingsDialog from "./components/settings-dialog/SettingsDialog";
import { useEffect, useRef, useState } from "react";
import "./App.scss";
import { LiveAPIProvider, useLiveAPIContext, LiveAPIContext } from "./contexts/LiveAPIContext";
import SidePanel from "./components/side-panel/SidePanel";
import { Altair } from "./components/altair/Altair";
import ControlTray from "./components/control-tray/ControlTray";
import cn from "classnames";
import { AuralisVoiceCircle } from "./components/audio-pulse/AuralisVoiceCircle";
import { syncChannel } from "./utils/sync-channel";
import Chat from "./components/chat/Chat";
import { WorkspaceManager } from "./components/workspace-management/WorkspaceManager";
import { ApiKeySetup } from "./components/auth/AuthGatekeeper";
import { ConnectionErrorModal } from "./components/connection-error-modal/ConnectionErrorModal";
import { useAppStore } from "./store/app-store";

function MiniApp() {
  const [syncState, setSyncState] = useState({
    connected: false,
    volume: 0,
    muted: false,
    isStreaming: false,
    inputVolume: 0,
    activeWebcam: false
  });

  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data.type === 'state-update') {
        setSyncState(prev => ({ ...prev, ...e.data.state }));
      }
    };
    syncChannel.addEventListener('message', handleMsg);

    // Request initial state from main window
    syncChannel.postMessage({ type: 'command', cmd: 'request-state' });

    return () => syncChannel.removeEventListener('message', handleMsg);
  }, []);

  const proxyValue: any = {
    connected: syncState.connected,
    volume: syncState.volume,
    muted: syncState.muted,
    isStreaming: syncState.isStreaming,
    inputVolume: syncState.inputVolume,
    activeWebcam: syncState.activeWebcam,
    connect: () => syncChannel.postMessage({ type: 'command', cmd: 'connect' }),
    disconnect: () => syncChannel.postMessage({ type: 'command', cmd: 'disconnect' }),
    setMuted: (muted: boolean) => syncChannel.postMessage({ type: 'command', cmd: 'setMuted', data: muted }),
    toggleScreenShare: () => syncChannel.postMessage({ type: 'command', cmd: 'toggleScreenShare' }),
    toggleWebcam: () => syncChannel.postMessage({ type: 'command', cmd: 'toggleWebcam' }),
  };

  return (
    <div className="App mini">
      <LiveAPIContext.Provider value={proxyValue}>
        <ControlTray
          supportsVideo={true}
          mode="mini"
          activeScreenShare={syncState.isStreaming}
          activeWebcam={syncState.activeWebcam}
          inputVolume={syncState.inputVolume}
        />
      </LiveAPIContext.Provider>
    </div>
  );
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  const {
    geminiApiKey,
    setGeminiApiKey,
    apiKeyLoading,
    setApiKeyLoading,
  } = useAppStore();

  useEffect(() => {
    const handleApiKeyLoad = async () => {
      const electron = (window as any).electron;
      if (electron?.auth?.getApiKey) {
        const key = await electron.auth.getApiKey();
        if (key) {
          setGeminiApiKey(key);
        }
      }
      setApiKeyLoading(false);
    };

    handleApiKeyLoad();
  }, [setGeminiApiKey, setApiKeyLoading]);

  // Mini window mode
  if ((window as any).electron?.isMini) {
    return <MiniApp />;
  }

  if (apiKeyLoading) {
    return (
      <div className="App" style={{ background: 'var(--neutral-05)' }}>
        {/* Minimal loading state */}
      </div>
    );
  }

  if (!geminiApiKey) {
    return (
      <div className="App">
        <ApiKeySetup />
      </div>
    );
  }

  return (
    <div className="App">
      <LiveAPIProvider>
        <div className="streaming-console">
          <AppContent videoRef={videoRef} videoStream={videoStream} setVideoStream={setVideoStream} />
        </div>
        <SettingsDialog />
        <Chat />
        <ConnectionErrorModal />
      </LiveAPIProvider>
    </div>
  );
}

function AppContent({
  videoRef,
  videoStream,
  setVideoStream
}: {
  videoRef: React.RefObject<HTMLVideoElement>,
  videoStream: MediaStream | null,
  setVideoStream: (s: MediaStream | null) => void
}) {
  const { showDeveloperPanel, connected, volume, connect, disconnect, muted, setMuted } = useLiveAPIContext();

  // Broadcast state to mini window
  useEffect(() => {
    syncChannel.postMessage({
      type: 'state-update',
      state: {
        connected,
        volume,
        muted,
        isStreaming: !!videoStream
      }
    });
  }, [connected, volume, muted, videoStream]);

  // Handle menu bar visibility
  useEffect(() => {
    const electron = (window as any).electron;
    if (electron?.sendMainWindowCommand) {
      electron.sendMainWindowCommand('setMenuBarVisibility', showDeveloperPanel);
    }
  }, [showDeveloperPanel]);

  // Listen for commands from mini window
  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data.type === 'command') {
        switch (e.data.cmd) {
          case 'connect':
            connect();
            break;
          case 'disconnect':
            disconnect();
            break;
          case 'setMuted': setMuted(e.data.data); break;
          case 'request-state':
            syncChannel.postMessage({
              type: 'state-update',
              state: {
                connected,
                volume,
                muted,
                isStreaming: !!videoStream,
                inputVolume: 0
              }
            });
            break;
        }
      }
    };
    syncChannel.addEventListener('message', handleMsg);
    return () => syncChannel.removeEventListener('message', handleMsg);
  }, [connect, disconnect, setMuted, videoStream, connected, volume, muted]);

  // Track whether the main window is hidden in the tray
  const isInTrayRef = useRef(false);

  // Handle Mini Window persistence via Electron IPC
  useEffect(() => {
    const electron = (window as any).electron;
    if (electron?.onMainWindowCommand) {
      return electron.onMainWindowCommand((cmd: string, data: any) => {
        if (cmd === 'window-state-changed') {
          if (data === 'minimized') {
            isInTrayRef.current = true;
            if (connected) electron.setMiniWindowActive(true);
          } else if (data === 'restored') {
            isInTrayRef.current = false;
            electron.setMiniWindowActive(false);
          }
        }

        if (cmd === 'toggleScreenShare' || cmd === 'toggleWebcam') {
          syncChannel.postMessage({ type: 'command', cmd });
        }
      });
    }
  }, [connected]);

  // Hide mini window when session disconnects while in tray
  useEffect(() => {
    const electron = (window as any).electron;
    if (!connected && isInTrayRef.current) {
      electron?.setMiniWindowActive(false);
    }
  }, [connected]);

  return (
    <>
      <WorkspaceManager />
      {showDeveloperPanel && <SidePanel />}
      <main>
        <div className="main-app-area">
          <AuralisVoiceCircle active={connected} volume={volume} />
          <Altair />
          <video
            className={cn("stream", {
              hidden: !videoRef.current || !videoStream,
            })}
            ref={videoRef}
            autoPlay
            playsInline
          />
        </div>

        <ControlTray
          videoRef={videoRef}
          supportsVideo={true}
          onVideoStreamChange={setVideoStream}
        >
          {/* put your own buttons here */}
        </ControlTray>
      </main>
    </>
  );
}

export default App;
