import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Personality } from "../lib/personalities";

interface AppState {
  geminiApiKey: string | null;
  setGeminiApiKey: (key: string | null) => void;
  apiKeyLoading: boolean;
  setApiKeyLoading: (loading: boolean) => void;

  audioInputDeviceId: string | null;
  setAudioInputDeviceId: (id: string | null) => void;
  audioOutputDeviceId: string | null;
  setAudioOutputDeviceId: (id: string | null) => void;
  showDeveloperPanel: boolean;
  setShowDeveloperPanel: (show: boolean) => void;
  showChat: boolean;
  setShowChat: (show: boolean) => void;
  volume: number;
  setVolume: (volume: number) => void;
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
  selectedPersonality: Personality;
  setSelectedPersonality: (personality: Personality) => void;
  // Session duration tracking
  sessionStartTime: number | null; // Date.now() at connect
  sessionElapsedSeconds: number;
  visionActiveSeconds: number;
  visionStartTime: number | null; // Date.now() when vision starts
  startSession: () => void;
  tickSession: () => void;
  startVision: () => void;
  stopVision: () => void;
  endSession: () => { voiceSeconds: number; visionSeconds: number; startedAt: string; endedAt: string } | null;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      geminiApiKey: null,
      setGeminiApiKey: (geminiApiKey: string | null) => set({ geminiApiKey }),
      apiKeyLoading: true,
      setApiKeyLoading: (apiKeyLoading: boolean) => set({ apiKeyLoading }),

      audioInputDeviceId: null,
      setAudioInputDeviceId: (audioInputDeviceId: string | null) => set({ audioInputDeviceId }),
      audioOutputDeviceId: null,
      setAudioOutputDeviceId: (audioOutputDeviceId: string | null) => set({ audioOutputDeviceId }),
      showDeveloperPanel: false,
      setShowDeveloperPanel: (showDeveloperPanel: boolean) => set({ showDeveloperPanel }),
      showChat: false,
      setShowChat: (showChat: boolean) => set({ showChat }),
      volume: 0.8,
      setVolume: (volume: number) => set({ volume }),
      selectedVoice: "Aoede",
      setSelectedVoice: (selectedVoice: string) => set({ selectedVoice }),
      enableAffectiveDialog: true,
      setEnableAffectiveDialog: (enableAffectiveDialog: boolean) => set({ enableAffectiveDialog }),
      enableProactiveAudio: false,
      setEnableProactiveAudio: (enableProactiveAudio: boolean) => set({ enableProactiveAudio }),
      enableTranscriptions: false,
      setEnableTranscriptions: (enableTranscriptions: boolean) => set({ enableTranscriptions }),
      userInstructions: "",
      setUserInstructions: (userInstructions: string) => set({ userInstructions }),
      experimentalFeatures: false,
      setExperimentalFeatures: (experimentalFeatures: boolean) => set({ experimentalFeatures }),
      selectedPersonality: Personality.GENERAL,
      setSelectedPersonality: (selectedPersonality: Personality) => set({ selectedPersonality }),
      // Session duration tracking
      sessionStartTime: null,
      sessionElapsedSeconds: 0,
      visionActiveSeconds: 0,
      visionStartTime: null,
      startSession: () => set({
        sessionStartTime: Date.now(),
        sessionElapsedSeconds: 0,
        visionActiveSeconds: 0,
        visionStartTime: null,
      }),
      tickSession: () => set((state) => {
        if (!state.sessionStartTime) return {};
        return { sessionElapsedSeconds: Math.floor((Date.now() - state.sessionStartTime) / 1000) };
      }),
      startVision: () => set((state) => {
        if (state.visionStartTime) return {}; // already tracking
        return { visionStartTime: Date.now() };
      }),
      stopVision: () => set((state) => {
        if (!state.visionStartTime) return {};
        const elapsed = Math.floor((Date.now() - state.visionStartTime) / 1000);
        return {
          visionActiveSeconds: state.visionActiveSeconds + elapsed,
          visionStartTime: null,
        };
      }),
      endSession: (): { voiceSeconds: number; visionSeconds: number; startedAt: string; endedAt: string } | null => {
        const state = get();
        if (!state.sessionStartTime) return null;
        // If vision is still active, finalize it
        let visionSecs: number = state.visionActiveSeconds;
        if (state.visionStartTime) {
          visionSecs += Math.floor((Date.now() - state.visionStartTime) / 1000);
        }
        const totalSeconds: number = Math.floor((Date.now() - state.sessionStartTime) / 1000);
        const voiceSecs: number = Math.max(0, totalSeconds - visionSecs);
        const result: { voiceSeconds: number; visionSeconds: number; startedAt: string; endedAt: string } = {
          voiceSeconds: voiceSecs,
          visionSeconds: visionSecs,
          startedAt: new Date(state.sessionStartTime).toISOString(),
          endedAt: new Date().toISOString(),
        };
        set({
          sessionStartTime: null,
          sessionElapsedSeconds: 0,
          visionActiveSeconds: 0,
          visionStartTime: null,
        });
        return result;
      },
    }),
    {
      name: "auralis-app-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => {
        const { geminiApiKey, apiKeyLoading,
          sessionStartTime, sessionElapsedSeconds, visionActiveSeconds, visionStartTime,
          ...rest } = state;
        return rest;
      },
    }
  )
);
