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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GenAILiveClient } from "../lib/genai-live-client";
import { PERSONALITY_PROMPTS } from "../lib/personalities";
import { AudioStreamer } from "../lib/audio-streamer";
import { audioContext } from "../lib/utils";
import VolMeterWorket from "../lib/worklets/vol-meter";
import { LiveConnectConfig } from "@google/genai";

import { useAppStore } from "../store/app-store";

import { DEFAULT_MODEL, DEFAULT_CONFIG, DEFAULT_SYSTEM_INSTRUCTION } from "../config";
import { useLoggerStore } from "../lib/store-logger";

export type UseLiveAPIResults = {
  client: GenAILiveClient | null;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;
  model: string;
  setModel: (model: string) => void;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  volume: number;
  audioInputDeviceId: string | null;
  setAudioInputDeviceId: (id: string | null) => void;
  audioOutputDeviceId: string | null;
  setAudioOutputDeviceId: (id: string | null) => void;
  showDeveloperPanel: boolean;
  setShowDeveloperPanel: (show: boolean) => void;
  showChat: boolean;
  setShowChat: (show: boolean) => void;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  outputVolume: number;
  setOutputVolume: (volume: number) => void;
  selectedVoice: string;
  setSelectedVoice: (voice: string) => void;
  enableAffectiveDialog: boolean;
  setEnableAffectiveDialog: (enabled: boolean) => void;
  enableProactiveAudio: boolean;
  setEnableProactiveAudio: (enabled: boolean) => void;
  enableTranscriptions: boolean;
  setEnableTranscriptions: (enabled: boolean) => void;
  userInstructions: string;
  setUserInstructions: (instructions: string) => void;
  experimentalFeatures: boolean;
  setExperimentalFeatures: (enabled: boolean) => void;
  connectionError: string | null;
  clearConnectionError: () => void;
  sessionElapsedSeconds: number;
};

export function useLiveAPI(): UseLiveAPIResults {
  const {
    geminiApiKey,
    audioInputDeviceId, setAudioInputDeviceId,
    audioOutputDeviceId, setAudioOutputDeviceId,
    showDeveloperPanel, setShowDeveloperPanel,
    showChat, setShowChat,
    volume: outputVolume, setVolume: setOutputVolume,
    selectedVoice, setSelectedVoice,
    enableAffectiveDialog, setEnableAffectiveDialog,
    enableProactiveAudio, setEnableProactiveAudio,
    enableTranscriptions, setEnableTranscriptions,
    userInstructions, setUserInstructions,
    experimentalFeatures, setExperimentalFeatures,
    selectedPersonality,
    startSession, tickSession, endSession,
    startVision, stopVision,
    sessionElapsedSeconds,
  } = useAppStore();

  const [activeToken, setActiveToken] = useState<string>("");
  const client = useMemo(() => {
    if (!activeToken) return null;
    return new GenAILiveClient({
      apiKey: activeToken,
      httpOptions: { apiVersion: 'v1alpha' }
    });
  }, [activeToken]);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [config, setConfig] = useState<LiveConnectConfig>(DEFAULT_CONFIG);
  const [connected, setConnected] = useState(false);
  const [volume, setVolume] = useState(0);
  const [muted, setMuted] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const lastHandleRef = useRef<string | null>(null);
  const latestConfigRef = useRef<LiveConnectConfig>(DEFAULT_CONFIG);
  const shouldReconnectRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 3;
  const isConnectedRef = useRef<boolean>(false);
  const { log } = useLoggerStore();

  // Set activeToken directly from geminiApiKey
  useEffect(() => {
    if (geminiApiKey) setActiveToken(geminiApiKey);
    else setActiveToken("");
  }, [geminiApiKey]);

  // Function to fetch tools and return updated config
  const fetchTools = useCallback(async (retryCount = 0): Promise<LiveConnectConfig> => {
    const electron = (window as any).electron;
    let mcpDeclarations: any[] = [];
    let mcpInstructions = "";
    let memoryInstructions = "";

    if (electron) {
      // 1. Fetch Memory Context
      try {
        const globalMem = await electron.memory.getGlobal();
        const workspaceMem = await electron.memory.getWorkspace();

        if (globalMem.length > 0 || workspaceMem.length > 0) {
          memoryInstructions = "\n\n# Your Persistent Memory:\n" +
            "You have access to the following persistent information about the user and the project.\n";

          if (globalMem.length > 0) {
            memoryInstructions += "## Global Memory (Preferences & General Facts):\n";
            globalMem.forEach((m: any) => memoryInstructions += `- [ID: ${m.id}] ${m.text}\n`);
          }

          if (workspaceMem.length > 0) {
            memoryInstructions += "## Workspace Memory (Project-specific context):\n";
            workspaceMem.forEach((m: any) => memoryInstructions += `- [ID: ${m.id}] ${m.text}\n`);
          }

          memoryInstructions += "\nUse 'add_memory_item' to remember new things and 'delete_memory_item' to remove outdated info.\n";
        }
      } catch (e) {
        console.error("Failed to fetch memory:", e);
      }

      // 2. Fetch MCP Tools
      if (electron.mcp && experimentalFeatures) {
        try {
          const mcpTools = await electron.mcp.getTools();

          if (mcpTools.length === 0 && retryCount < 3) {
            console.log(`[LiveAPI] No tools found, retrying in 2s... (attempt ${retryCount + 1})`);
            await new Promise(r => setTimeout(r, 2000));
            return fetchTools(retryCount + 1);
          }

          mcpDeclarations = mcpTools.map((tool: any) => ({
            name: tool.name,
            description: tool.description || `Execute ${tool.name}`,
            parameters: tool.inputSchema || { type: 'object', properties: {} }
          }));

          if (mcpTools.length > 0) {
            mcpInstructions = "\n\n# System Capabilities:\n" +
              "You have direct access to the following system tools. Use them to help the user with their requests.\n";

            mcpTools.forEach((tool: any) => {
              mcpInstructions += `- ${tool.name}: ${tool.description || ''}\n`;
            });
            console.log(`[LiveAPI] Successfully merged ${mcpTools.length} system tools.`);
          }
        } catch (e) {
          console.error("Failed to fetch tools:", e);
        }
      }
    }

    const defaultFunctionDeclarations = DEFAULT_CONFIG.tools.find((t: any) => t.functionDeclarations)?.functionDeclarations || [];
    const allDeclarations = [
      ...defaultFunctionDeclarations,
      ...mcpDeclarations
    ];

    const newConfig: any = {
      ...DEFAULT_CONFIG,
      sessionResumption: { handle: lastHandleRef.current || undefined },
      tools: [
        { googleSearch: {} },
        { functionDeclarations: allDeclarations }
      ],
      systemInstruction: {
        parts: [{
          text: (PERSONALITY_PROMPTS[selectedPersonality] || DEFAULT_SYSTEM_INSTRUCTION) +
                (userInstructions ? `\n\nThis is an instruction by the user, please try to accomodate it as well: ${userInstructions}, don't mention this message in your firs responce to user unless specifically asked` : "") +
                memoryInstructions +
                mcpInstructions +
                "\n\n# Current Session Status:\nScreen sharing: INACTIVE\nCamera: INACTIVE\nYou have no visual input right now. Vision only becomes available after the user or you explicitly starts screen sharing or the camera."
        }],
      },
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
      },
      enableAffectiveDialog: enableAffectiveDialog,
      proactivity: {
        proactiveAudio: enableProactiveAudio
      },
      ...(enableTranscriptions ? {
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      } : {})
    };

    console.log("[LiveAPI] Session configured with tools:", allDeclarations.map(d => d.name));
    setConfig(newConfig);
    latestConfigRef.current = newConfig;
    return newConfig;
  }, [selectedVoice, enableAffectiveDialog, enableProactiveAudio, enableTranscriptions, userInstructions, experimentalFeatures, selectedPersonality]);

  // Sync tools on mount or settings change
  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  // Handle Tool Calls
  useEffect(() => {
    const handleToolCall = async (toolCall: any) => {
      console.log('Received tool call:', toolCall);
      const electron = (window as any).electron;
      if (electron && toolCall.functionCalls) {
        const responses = await Promise.all(toolCall.functionCalls.map(async (fc: any) => {
          try {
            useLoggerStore.getState().log({
              date: new Date(),
              type: "client.toolCall",
              message: `Executing ${fc.name}`
            });

            // Handle Memory Tools
            if (fc.name === 'add_memory_item') {
              const result = await electron.memory.add(fc.args.scope, fc.args.text);
              return { name: fc.name, id: fc.id, response: result };
            }

            if (fc.name === 'delete_memory_item') {
              const result = await electron.memory.delete(fc.args.id);
              return { name: fc.name, id: fc.id, response: { success: result } };
            }

            if (fc.name === 'list_workspace_files') {
              const result = await electron.memory.listFiles();
              return { name: fc.name, id: fc.id, response: result };
            }

            if (fc.name === 'get_file_metadata') {
              const result = await electron.memory.getMetadata(fc.args.path);
              return { name: fc.name, id: fc.id, response: result };
            }

            // App Control Tools
            if (fc.name === 'set_volume') {
              const vol = Math.max(0, Math.min(100, fc.args.volume)) / 100;
              setOutputVolume(vol);
              return { name: fc.name, id: fc.id, response: { success: true, volume: fc.args.volume } };
            }

            if (fc.name === 'set_muted') {
              setMuted(fc.args.muted);
              return { name: fc.name, id: fc.id, response: { success: true, muted: fc.args.muted } };
            }

            if (fc.name === 'set_chat_open') {
              setShowChat(fc.args.open);
              return { name: fc.name, id: fc.id, response: { success: true, open: fc.args.open } };
            }

            if (fc.name === 'disconnect_session') {
              disconnect();
              return { name: fc.name, id: fc.id, response: { success: true } };
            }

            if (fc.name === 'get_settings') {
              return {
                name: fc.name,
                id: fc.id,
                response: {
                  volume: Math.round(outputVolume * 100),
                  muted: muted,
                  showChat: showChat,
                  showDeveloperPanel: showDeveloperPanel
                }
              };
            }

            if (fc.name === 'paste_text') {
              return { name: fc.name, id: fc.id, response: { success: true } };
            }

            if (fc.name === 'start_screen_share') {
              const source = await electron.getActiveDisplaySource();
              window.dispatchEvent(new CustomEvent('auralis:startScreenShare', { detail: { sourceId: source?.id } }));
              return { name: fc.name, id: fc.id, response: { success: true, display: source?.name || 'screen' } };
            }

            if (fc.name === 'stop_screen_share') {
              window.dispatchEvent(new CustomEvent('auralis:stopScreenShare'));
              return { name: fc.name, id: fc.id, response: { success: true } };
            }

            // Fallback to MCP
            if (electron.mcp && experimentalFeatures) {
              const result = await electron.mcp.callTool(fc.name, fc.args);
              return {
                name: fc.name,
                id: fc.id,
                response: result
              };
            }

            return { name: fc.name, id: fc.id, response: { error: "No tool handler found" } };
          } catch (e: any) {
            console.error(e);
            return {
              name: fc.name,
              id: fc.id,
              response: { error: e.message }
            };
          }
        }));

        log({
          date: new Date(),
          type: "client.toolResponse",
          message: `Sending responses for: ${responses.map(r => r.name).join(", ")}`
        });
        client?.sendToolResponse({ functionResponses: responses });
      }
    };

    client?.on('toolcall', handleToolCall);
    return () => {
      client?.off('toolcall', handleToolCall);
    };
  }, [client]);

  // Audio setup
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: "audio-out" }).then((audioCtx: AudioContext) => {
        const streamer = new AudioStreamer(audioCtx);
        audioStreamerRef.current = streamer;
        if (audioOutputDeviceId) streamer.setAudioOutput(audioOutputDeviceId);
        streamer.setVolume(outputVolume);
        streamer.addWorklet<any>("vumeter-out", VolMeterWorket, (ev: MessageEvent<{ volume: number }>) => setVolume(ev.data.volume));
      });
    }
  }, [audioOutputDeviceId, outputVolume]);

  useEffect(() => {
    if (audioStreamerRef.current && audioOutputDeviceId) {
      audioStreamerRef.current.setAudioOutput(audioOutputDeviceId);
    }
  }, [audioOutputDeviceId]);

  useEffect(() => {
    if (audioStreamerRef.current) {
      audioStreamerRef.current.setVolume(outputVolume);
    }
  }, [outputVolume]);

  const connect = useCallback(async () => {
    setConnectionError(null);
    shouldReconnectRef.current = true;
    reconnectAttemptsRef.current = 0;

    if (!activeToken) {
      setConnectionError("No API key set. Please add your Gemini API key in Settings.");
      return;
    }

    // Tear down any stale session first
    client?.disconnect();
    setIsConnecting(true);
  }, [activeToken, client]);

  // Effect to perform actual connection once client is ready
  useEffect(() => {
    const performConnect = async () => {
      if (isConnecting && activeToken && client) {
        try {
          await client.connect(model, latestConfigRef.current);
          setIsConnecting(false);
        } catch (e: any) {
          console.error("[LiveAPI] Connection Error:", e);
          setConnectionError("Failed to establish connection to Gemini.");
          setIsConnecting(false);
          shouldReconnectRef.current = false;
        }
      }
    };
    performConnect();
  }, [isConnecting, activeToken, client, model]);

  const disconnect = useCallback(async () => {
    shouldReconnectRef.current = false;
    endSession();
    client?.disconnect();
    setConnected(false);
    setIsConnecting(false);
    isConnectedRef.current = false;
  }, [client, endSession]);

  const handleReconnect = useCallback(async () => {
    if (!shouldReconnectRef.current) return;

    if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttemptsRef.current += 1;

      try {
        await client?.connect(model, latestConfigRef.current);
      } catch (e) {
        console.error("[LiveAPI] Reconnection failed:", e);
      }
    } else {
      shouldReconnectRef.current = false;
      setConnected(false);
      setConnectionError("Unable to establish connection after multiple attempts. Please check your API Key and internet connection.");
    }
  }, [client, model, MAX_RECONNECT_ATTEMPTS]);

  useEffect(() => {
    const onOpen = () => {
      setConnected(true);
      isConnectedRef.current = true;
      startSession();

      if (reconnectAttemptsRef.current > 0) {
        client?.send({ text: "SYSTEM: The connection has been restored after an unexpected disconnection. Please briefly apologize to the user for the interruption and ask what they were talking about." }, true);
      }

      reconnectAttemptsRef.current = 0;
      setConnectionError(null);
    };

    const onClose = (e: CloseEvent) => {
      setConnected(false);
      isConnectedRef.current = false;

      const reason = e.reason || 'No reason';
      const code = e.code || 'No code';

      log({
        date: new Date(),
        type: "server.close",
        message: `Connection closed: ${reason} (Code: ${code})`
      });

      if (shouldReconnectRef.current) {
        setTimeout(handleReconnect, 2000);
      }
    };

    const onError = (error: ErrorEvent) => {
      console.error("[LiveAPI] Error event:", error);
      log({
        date: new Date(),
        type: "server.error",
        message: `WebSocket Error: ${error.message || 'Unknown error'}`
      });
    };

    const stopAudioStreamer = () => audioStreamerRef.current?.stop();

    const onAudio = (data: ArrayBuffer) => {
      audioStreamerRef.current?.addPCM16(new Uint8Array(data));
    };

    const onGoAway = (timeLeft: string) => {
      client?.send({ text: "SYSTEM: The connection is about to be reset for maintenance. Please briefly inform the user that you will reconnect in a moment to continue the conversation." }, true);
    };

    const onSessionResumptionUpdate = (update: { resumable: boolean, newHandle: string }) => {
      if (update.resumable && update.newHandle) {
        lastHandleRef.current = update.newHandle;
      } else {
        lastHandleRef.current = null;
      }
    };

    // Session timer: tick every second
    const tickInterval = setInterval(() => {
      tickSession();
    }, 1000);

    client
      ?.on("error", onError)
      .on("open", onOpen)
      .on("close", onClose)
      .on("interrupted", stopAudioStreamer)
      .on("audio", onAudio)
      .on("log", log)
      .on("goaway", onGoAway)
      .on("sessionresumptionupdate", onSessionResumptionUpdate);

    return () => {
      clearInterval(tickInterval);
      client
        ?.off("error", onError)
        .off("open", onOpen)
        .off("close", onClose)
        .off("interrupted", stopAudioStreamer)
        .off("audio", onAudio)
        .off("log", log)
        .off("goaway", onGoAway)
        .off("sessionresumptionupdate", onSessionResumptionUpdate);
    };
  }, [client, log, handleReconnect, startSession, tickSession]);

  return {
    client,
    config,
    setConfig,
    model,
    setModel,
    connected,
    connect,
    disconnect,
    volume,
    audioInputDeviceId,
    setAudioInputDeviceId,
    audioOutputDeviceId,
    setAudioOutputDeviceId,
    showDeveloperPanel,
    setShowDeveloperPanel,
    showChat,
    setShowChat,
    muted,
    setMuted,
    outputVolume,
    setOutputVolume,
    selectedVoice,
    setSelectedVoice,
    enableAffectiveDialog,
    setEnableAffectiveDialog,
    enableProactiveAudio,
    setEnableProactiveAudio,
    enableTranscriptions,
    setEnableTranscriptions,
    userInstructions,
    setUserInstructions,
    experimentalFeatures,
    setExperimentalFeatures,
    connectionError,
    clearConnectionError: () => setConnectionError(null),
    sessionElapsedSeconds,
  };
}
