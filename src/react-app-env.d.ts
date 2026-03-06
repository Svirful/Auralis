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

/// <reference types="react-scripts" />

interface Window {
  electron: {
    getSources: () => Promise<any[]>;
    getActiveDisplaySource: () => Promise<{ id: string; name: string } | null>;
    showScreenOverlay: () => Promise<void>;
    hideScreenOverlay: () => Promise<void>;
    setSelectedSource: (id: string) => void;
    onHotkeyTriggered: (callback: (sourceId: string) => void) => () => void;
    sendMainWindowCommand: (cmd: string, data: any) => void;
    onMainWindowCommand: (callback: (cmd: string, data: any) => void) => () => void;
    setMiniWindowActive: (active: boolean) => void;
    isMini: boolean;
    mcp: {
        getTools: () => Promise<any[]>;
        callTool: (name: string, args: any) => Promise<any>;
        getConfig: () => Promise<any>;
        setConfig: (config: any) => Promise<boolean>;
        addServerJson: (json: string) => Promise<{success: boolean, error?: string}>;
    };
    skills: {
        getAll: () => Promise<any[]>;
        save: (skillData: { name: string; description: string; instructions: string }) => Promise<{success: boolean; error?: string}>;
        delete: (id: string) => Promise<{success: boolean; error?: string}>;
    }
  }
}
