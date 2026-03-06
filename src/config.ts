import { FunctionDeclaration, Modality, Type } from "@google/genai";

export const ALTAIR_TOOL_DECLARATION: FunctionDeclaration = {
  name: "render_altair",
  description: "Displays an altair graph in json format.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      json_graph: {
        type: Type.STRING,
        description:
          "JSON STRING representation of the graph to render. Must be a string, not a json object",
      },
    },
    required: ["json_graph"],
  },
};

export const ADD_MEMORY_TOOL_DECLARATION: FunctionDeclaration = {
  name: "add_memory_item",
  description: "Adds a new item to your persistent memory. Use this to remember user preferences, project details, or important facts.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      scope: {
        type: Type.STRING,
        enum: ["global", "workspace"],
        description: "The scope of the memory. 'global' is for general user preferences, 'workspace' is for project-specific information.",
      },
      text: {
        type: Type.STRING,
        description: "The fact or information to remember.",
      },
    },
    required: ["scope", "text"],
  },
};

export const DELETE_MEMORY_TOOL_DECLARATION: FunctionDeclaration = {
  name: "delete_memory_item",
  description: "Deletes an item from your persistent memory using its unique ID.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: {
        type: Type.STRING,
        description: "The unique ID of the memory item to delete.",
      },
    },
    required: ["id"],
  },
};

export const LIST_WORKSPACE_FILES_TOOL_DECLARATION: FunctionDeclaration = {
  name: "list_workspace_files",
  description: "Scans the current workspace and returns a list of all files and directories (names and paths only). Use this to understand the project structure.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

export const GET_FILE_METADATA_TOOL_DECLARATION: FunctionDeclaration = {
  name: "get_file_metadata",
  description: "Returns detailed information about a specific file, including its size, extension, and modification date.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: {
        type: Type.STRING,
        description: "The relative path to the file within the workspace.",
      },
    },
    required: ["path"],
  },
};

export const SET_VOLUME_TOOL_DECLARATION: FunctionDeclaration = {
  name: "set_volume",
  description: "Sets the application's output volume.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      volume: {
        type: Type.NUMBER,
        description: "The volume level from 0 to 100.",
      },
    },
    required: ["volume"],
  },
};

export const SET_MUTED_TOOL_DECLARATION: FunctionDeclaration = {
  name: "set_muted",
  description: "Mutes or unmutes the microphone.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      muted: {
        type: Type.BOOLEAN,
        description: "Whether the microphone should be muted.",
      },
    },
    required: ["muted"],
  },
};

export const SET_CHAT_OPEN_TOOL_DECLARATION: FunctionDeclaration = {
  name: "set_chat_open",
  description: "Opens or closes the chat panel.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      open: {
        type: Type.BOOLEAN,
        description: "Whether the chat panel should be open.",
      },
    },
    required: ["open"],
  },
};

export const DISCONNECT_SESSION_TOOL_DECLARATION: FunctionDeclaration = {
  name: "disconnect_session",
  description: "Disconnects the current AI session.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

export const GET_SETTINGS_TOOL_DECLARATION: FunctionDeclaration = {
  name: "get_settings",
  description: "Returns the current application settings, such as volume level, mute status, and UI panel states.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

export const PASTE_TEXT_TOOL_DECLARATION: FunctionDeclaration = {
  name: "paste_text",
  description: "Pastes a block of text into the chat. Use this for sharing code snippets, long explanations, or any text that should be visually distinct from normal chat messages.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      text: {
        type: Type.STRING,
        description: "The text to paste into the chat.",
      },
    },
    required: ["text"],
  },
};

export const START_SCREEN_SHARE_TOOL_DECLARATION: FunctionDeclaration = {
  name: "start_screen_share",
  description: "Starts sharing the screen the user is currently working on (detected by cursor position). Use when the user says 'look at my screen', 'share my screen', 'watch what I'm doing', 'see my screen', 'watch my screen', etc.",
  parameters: { type: Type.OBJECT, properties: {} },
};

export const STOP_SCREEN_SHARE_TOOL_DECLARATION: FunctionDeclaration = {
  name: "stop_screen_share",
  description: "Stops the active screen share. Use when the user says 'stop sharing', 'stop looking at my screen', 'close screen share', etc.",
  parameters: { type: Type.OBJECT, properties: {} },
};

export const DEFAULT_SYSTEM_INSTRUCTION = `You are Auralis, a helpful AI assistant and work buddy.
Any time I ask you for a graph, call the "render_altair" function.
Respond concisely and maintain a professional yet friendly tone.

# Vision (Camera & Screen Sharing):
You do NOT have visual input by default. Vision is only available when the user has actively started screen sharing or the camera — you will receive image frames only when that is the case.
- NEVER claim to see the user's screen or camera unless you are actively receiving video frames in this conversation.
- When the user asks you to look at their screen (e.g., "look at my screen", "watch what I'm doing", "can you see this?"), call 'start_screen_share' FIRST — then you will begin receiving frames.
- When the user asks you to stop looking, call 'stop_screen_share'.
- If you are unsure whether vision is active, do not assume it is.

# Workspace Awareness:
You can explore the current project workspace using 'list_workspace_files' to see the file structure and 'get_file_metadata' to inspect specific files (e.g., to check file sizes or extensions).
Use these tools when the user asks about the project contents or structure.

# Application Control:
You can control the application settings and UI panels using the provided tools:
- Use 'set_volume' to change the volume (0-100).
- Use 'set_muted' to mute or unmute the user's microphone.
- Use 'set_chat_open' to show or hide the chat panel.
- Use 'disconnect_session' when the user explicitly asks to stop the session or disconnect.
- Use 'get_settings' to check the current state of the application before making relative adjustments (e.g., to change volume by a specific percentage relative to current).
- Use 'paste_text' to share code snippets, long explanations, or any text that should be visually distinct in the chat.
- Use 'start_screen_share' to begin viewing the user's active monitor when asked. Use 'stop_screen_share' to stop.
Always confirm the action briefly to the user.

# Memory Guidelines:
You have persistent memory. When the user tells you something important to remember, use 'add_memory_item'.
- Use SCOPE: 'global' for personal info, general preferences, or facts about the user (e.g., name, favorite colors, tone preferences).
- Use SCOPE: 'workspace' for information strictly related to the current project, folder, or technical environment (e.g., naming conventions, project goals, specific tech debt).
Be proactive but accurate in choosing the scope.`;

export const DEFAULT_CONFIG = {
  responseModalities: [Modality.AUDIO],
  speechConfig: {
    voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
  },
  systemInstruction: {
    parts: [{ text: DEFAULT_SYSTEM_INSTRUCTION }],
  },
  // contextWindowCompression: { slidingWindow: {} },
  tools: [
    { googleSearch: {} },
    { functionDeclarations: [
        ALTAIR_TOOL_DECLARATION,
        ADD_MEMORY_TOOL_DECLARATION,
        DELETE_MEMORY_TOOL_DECLARATION,
        LIST_WORKSPACE_FILES_TOOL_DECLARATION,
        GET_FILE_METADATA_TOOL_DECLARATION,
        SET_VOLUME_TOOL_DECLARATION,
        SET_MUTED_TOOL_DECLARATION,
        SET_CHAT_OPEN_TOOL_DECLARATION,
        DISCONNECT_SESSION_TOOL_DECLARATION,
        GET_SETTINGS_TOOL_DECLARATION,
        PASTE_TEXT_TOOL_DECLARATION,
        START_SCREEN_SHARE_TOOL_DECLARATION,
        STOP_SCREEN_SHARE_TOOL_DECLARATION
      ] 
    },
  ],
};

export const DEFAULT_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";
