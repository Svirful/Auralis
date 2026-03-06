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

import { create } from "zustand";
import { StreamingLog } from "../types";

interface StoreLoggerState {
  maxLogs: number;
  logs: StreamingLog[];
  log: (streamingLog: StreamingLog) => void;
  clearLogs: () => void;
}

export const useLoggerStore = create<StoreLoggerState>((set, get) => ({
  maxLogs: 1000,
  logs: [], //mockLogs,
  log: ({ date, type, message }: StreamingLog) => {
    set((state) => {
      const prevLog = state.logs.at(-1);
      
      // Helper to check if it's an audio chunk message
      const isAudioChunk = (msg: any) => 
        msg && typeof msg === 'object' && 
        msg.serverContent?.modelTurn?.parts?.[0]?.inlineData;

      const messagesMatch = (m1: any, m2: any) => {
          if (m1 === m2) return true;
          if (typeof m1 !== 'object' || typeof m2 !== 'object') return false;
          
          // Special case for audio chunks: check mimeType but ignore data (it's always unique)
          if (isAudioChunk(m1) && isAudioChunk(m2)) {
              return m1.serverContent.modelTurn.parts[0].inlineData.mimeType === 
                     m2.serverContent.modelTurn.parts[0].inlineData.mimeType;
          }
          return false;
      };

      if (prevLog && prevLog.type === type && messagesMatch(prevLog.message, message)) {
        return {
          logs: [
            ...state.logs.slice(0, -1),
            {
              date,
              type,
              message: isAudioChunk(message) ? prevLog.message : message, // keep first ref for audio
              count: (prevLog.count || 1) + 1,
            } as StreamingLog,
          ],
        };
      }
      return {
        logs: [
          ...state.logs.slice(-(get().maxLogs - 1)),
          {
            date,
            type,
            message,
          } as StreamingLog,
        ],
      };
    });
  },

  clearLogs: () => {
    console.log("clear log");
    set({ logs: [] });
  },
  setMaxLogs: (n: number) => set({ maxLogs: n }),
}));
