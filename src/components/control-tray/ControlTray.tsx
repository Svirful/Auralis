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

import cn from "classnames";

import { memo, ReactNode, RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { UseMediaStreamResult } from "../../hooks/use-media-stream-mux";
import { useScreenCapture } from "../../hooks/use-screen-capture";
import { useWebcam } from "../../hooks/use-webcam";
import { AudioRecorder } from "../../lib/audio-recorder";
import { useAppStore } from "../../store/app-store";
import "./control-tray.scss";
import { syncChannel } from "../../utils/sync-channel";


export type ControlTrayProps = {
  videoRef?: RefObject<HTMLVideoElement>;
  children?: ReactNode;
  supportsVideo: boolean;
  onVideoStreamChange?: (stream: MediaStream | null) => void;
  mode?: "normal" | "mini";
  activeScreenShare?: boolean; // For mini mode sync
  activeWebcam?: boolean;
  supportsScreenshare?: boolean;
  inputVolume?: number;
};

interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
}

type MediaStreamButtonProps = {
  isStreaming: boolean;
  onIcon: string;
  offIcon: string;
  start: () => Promise<MediaStream | null>;
  stop: () => void;
};

/**
 * button used for triggering webcam or screen-capture
 */
const MediaStreamButton = memo(
  ({ isStreaming, onIcon, offIcon, start, stop }: MediaStreamButtonProps) =>
    isStreaming ? (
      <button className="action-button" onClick={stop}>
        <span className="material-symbols-outlined">{onIcon}</span>
      </button>
    ) : (
      <button className="action-button" onClick={start}>
        <span className="material-symbols-outlined">{offIcon}</span>
      </button>
    )
);

function ControlTray({
  videoRef,
  children,
  onVideoStreamChange = () => {},
  supportsVideo,
  mode = "normal",
  activeScreenShare = false,
  activeWebcam = false,
  supportsScreenshare = true,
  inputVolume = 0,
}: ControlTrayProps) {
  const webcam = useWebcam();
  const screenCapture = useScreenCapture();
  const videoStreams = useMemo(() => [webcam, screenCapture], [webcam, screenCapture]);
  const [activeVideoStream, setActiveVideoStream] =
    useState<MediaStream | null>(null);
  const [inVolume, setInVolume] = useState(0);
  const [audioRecorder] = useState(() => new AudioRecorder());
  // const [muted, setMuted] = useState(false); // REMOVED
  const renderCanvasRef = useRef<HTMLCanvasElement>(null);
  const connectButtonRef = useRef<HTMLButtonElement>(null);
  const [screenSources, setScreenSources] = useState<ScreenSource[]>([]);
  const [showScreenPicker, setShowScreenPicker] = useState(false);

  const { 
    client, connected, connect, disconnect, volume,
    audioInputDeviceId, muted, setMuted,
    showChat, setShowChat,
  } = useLiveAPIContext();

  const { startVision, stopVision } = useAppStore();

  // Track vision on/off when video stream changes
  useEffect(() => {
    if (activeVideoStream) {
      startVision();
    } else {
      stopVision();
    }
  }, [activeVideoStream, startVision, stopVision]);

  // Broadcast input volume changes in normal mode
  useEffect(() => {
    if (mode === "normal") {
      syncChannel.postMessage({ 
        type: 'state-update', 
        state: { 
          inputVolume: inVolume,
          activeWebcam: webcam.isStreaming,
          isStreaming: screenCapture.isStreaming // We use isStreaming for screenShare mostly 
        } 
      });
    }
  }, [inVolume, mode, webcam.isStreaming, screenCapture.isStreaming]);

  // Use prop in mini mode
  const effectiveInputVolume = mode === "mini" ? inputVolume : inVolume;

  useEffect(() => {
    if (!connected && connectButtonRef.current) {
      connectButtonRef.current.focus();
    }
  }, [connected]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--volume",
      `${Math.max(0, Math.min(effectiveInputVolume * 100, 20))}`
    );
  }, [effectiveInputVolume]);

  useEffect(() => {
    const onData = (base64: string) => {
      client?.sendRealtimeInput([
        {
          mimeType: "audio/pcm;rate=16000",
          data: base64,
        },
      ]);
    };
    if (mode === "mini") return; // Mini mode doesn't handle audio processing

    if (connected && !muted && audioRecorder) {
      audioRecorder
        .on("data", onData)
        .on("volume", setInVolume)
        .start(audioInputDeviceId || undefined);
    } else {
      audioRecorder.stop();
    }
    return () => {
      audioRecorder.off("data", onData).off("volume", setInVolume);
    };
  }, [connected, client, muted, audioRecorder, audioInputDeviceId, mode]);

  useEffect(() => {
    if (!connected) {
      videoStreams.forEach((v) => v.stop());
      setActiveVideoStream(null);
      onVideoStreamChange(null);
    }
  }, [connected, videoStreams, onVideoStreamChange]);

  useEffect(() => {
    if (videoRef?.current) {
      videoRef.current.srcObject = activeVideoStream;
    }

    let timeoutId = -1;

    function sendVideoFrame() {
      const video = videoRef?.current;
      const canvas = renderCanvasRef.current;

      if (!video || !canvas) {
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Gemini handles roughly 1-2 frames per second comfortably for context
      // We'll scale down to 1024px height/width max to ensure small details are visible
      const scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;

      if (canvas.width > 0 && canvas.height > 0) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", 0.9);
        const data = base64.slice(base64.indexOf(",") + 1);
        client?.sendRealtimeInput([{ mimeType: "image/jpeg", data }]);
      }
      
      if (connected && activeVideoStream) {
        timeoutId = window.setTimeout(sendVideoFrame, 1000); // 1 FPS is usually enough for Live context
      }
    }

    if (connected && activeVideoStream !== null) {
      setTimeout(sendVideoFrame, 10);
    }
    return () => {
      clearTimeout(timeoutId);
    };
  }, [connected, activeVideoStream, client, videoRef]);

  //handler for swapping from one video-stream to the next
  const changeStreams = useCallback((next?: UseMediaStreamResult) => async (arg?: any): Promise<MediaStream | null> => {
    if (next?.type === "screen" && !next.isStreaming && !arg) {
      if ((window as any).electron) {
        const sources = await (window as any).electron.getSources();
        setScreenSources(sources);
        setShowScreenPicker(true);
      } else {
        // Fallback for web if no electron
        const mediaStream = await next.start();
        setActiveVideoStream(mediaStream);
        onVideoStreamChange(mediaStream);
        return mediaStream;
      }
      return null;
    }

    videoStreams.filter((msr) => msr !== next).forEach((msr) => msr.stop());
    if (next) {
      const mediaStream = await next.start(arg);
      setActiveVideoStream(mediaStream);
      onVideoStreamChange(mediaStream);
      setShowScreenPicker(false);
      return mediaStream;
    } else {
      setActiveVideoStream(null);
      onVideoStreamChange(null);
      setShowScreenPicker(false);
      return null;
    }
  }, [videoStreams, onVideoStreamChange]);

  useEffect(() => {
    const electron = (window as any).electron;
    if (!electron) return;
    if (screenCapture.isStreaming) {
      electron.showScreenOverlay();
    } else {
      electron.hideScreenOverlay();
    }
  }, [screenCapture.isStreaming]);

  useEffect(() => {
    const handleStartScreenShare = (e: Event) => {
      const { sourceId } = (e as CustomEvent).detail;
      changeStreams(screenCapture)(sourceId);
    };
    const handleStopScreenShare = () => {
      changeStreams(undefined)();
    };
    window.addEventListener('auralis:startScreenShare', handleStartScreenShare);
    window.addEventListener('auralis:stopScreenShare', handleStopScreenShare);
    return () => {
      window.removeEventListener('auralis:startScreenShare', handleStartScreenShare);
      window.removeEventListener('auralis:stopScreenShare', handleStopScreenShare);
    };
  }, [changeStreams, screenCapture]);

  useEffect(() => {
    const electron = (window as any).electron;

    const handleHotkey = (sourceId: string) => {
      console.log("Hotkey triggered connection with source:", sourceId);
      if (!connected) {
        connect();
      }
      setTimeout(() => {
        changeStreams(screenCapture)(sourceId);
      }, 500);
    };

    const handleSyncCommand = (e: MessageEvent) => {
      if (e.data.type === 'command') {
        if (e.data.cmd === 'toggleScreenShare') {
          changeStreams(screenCapture.isStreaming ? undefined : screenCapture)();
        } else if (e.data.cmd === 'toggleWebcam') {
          changeStreams(webcam.isStreaming ? undefined : webcam)();
        } else if (e.data.cmd === 'startScreenShare') {
          changeStreams(screenCapture)(e.data.sourceId);
        } else if (e.data.cmd === 'stopScreenShare') {
          changeStreams(undefined)();
        }
      }
    };

    let cleanupHotkey: any;
    if (electron && electron.onHotkeyTriggered) {
      cleanupHotkey = electron.onHotkeyTriggered(handleHotkey);
    }

    const syncChannel = new BroadcastChannel('auralis-sync');
    syncChannel.addEventListener('message', handleSyncCommand);

    return () => {
      if (cleanupHotkey) cleanupHotkey();
      syncChannel.removeEventListener('message', handleSyncCommand);
      syncChannel.close();
    };
  }, [connected, connect, screenCapture, webcam, changeStreams]);

  return (
    <section className={cn("control-tray", mode, { speaking: volume > 0.01 })}>
      <canvas style={{ display: "none" }} ref={renderCanvasRef} />
      
      {showScreenPicker && (
        <div className="screen-picker">
          <header>
            <h3>Select Screen</h3>
            <button onClick={() => setShowScreenPicker(false)}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </header>
          <div className="sources-grid">
            {screenSources.map(source => (
              <div 
                key={source.id} 
                className="source-item"
                onClick={() => changeStreams(screenCapture)(source.id)}
              >
                <div className="thumbnail-container">
                  <img src={source.thumbnail} alt={source.name} />
                </div>
                <span>{source.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <nav className={cn("actions-nav", { disabled: !connected })}>
        <button
          className={cn("action-button mic-button")}
          onClick={() => setMuted(!muted)}
        >
          {!muted ? (
            <span className="material-symbols-outlined filled">mic</span>
          ) : (
            <span className="material-symbols-outlined filled">mic_off</span>
          )}
        </button>

        {supportsVideo && (
          <>
            <MediaStreamButton
              isStreaming={mode === "mini" ? activeScreenShare : screenCapture.isStreaming}
              start={mode === "mini" ? (async () => { (window as any).electron?.sendMainWindowCommand({cmd: 'toggleScreenShare'}); return null; }) : () => changeStreams(screenCapture)()}
              stop={mode === "mini" ? (async () => { (window as any).electron?.sendMainWindowCommand({cmd: 'toggleScreenShare'}); return null; }) : () => changeStreams()()}
              onIcon="cancel_presentation"
              offIcon="present_to_all"
            />
            <MediaStreamButton
              isStreaming={mode === "mini" ? activeWebcam : webcam.isStreaming}
              start={mode === "mini" ? (async () => { (window as any).electron?.sendMainWindowCommand({cmd: 'toggleWebcam'}); return null; }) : () => changeStreams(webcam)()}
              stop={mode === "mini" ? (async () => { (window as any).electron?.sendMainWindowCommand({cmd: 'toggleWebcam'}); return null; }) : () => changeStreams()()}
              onIcon="videocam_off"
              offIcon="videocam"
            />
          </>
        )}
        <button
          className={cn("action-button chat-button", { active: showChat })}
          onClick={() => setShowChat(!showChat)}
        >
          <span className="material-symbols-outlined filled">forum</span>
        </button>
        {children}
      </nav>

      <div className={cn("connection-container", { connected })}>
        <div className="connection-button-container">
          <button
            ref={connectButtonRef}
            className={cn("action-button connect-toggle", { connected })}
            onClick={() => {
              if (connected) {
                disconnect();
              } else {
                connect();
              }
            }}
          >
            <span className="material-symbols-outlined filled">
              {connected ? "pause" : "play_arrow"}
            </span>
          </button>
        </div>
        <span className="text-indicator">
          {connected ? 'Streaming' : ''}
        </span>
      </div>
      
    </section>
  );
}

export default memo(ControlTray);
