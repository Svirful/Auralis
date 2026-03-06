# Auralis

A desktop AI voice assistant powered by the [Gemini Live API](https://ai.google.dev/api/multimodal-live). Talk to Gemini in real time — hands-free, with screen sharing and full system integration.

Built with Electron + React + TypeScript. No backend required. Your API key stays on your machine.

![Auralis UI](public/logo512.png)

---

## Features

- **Real-time voice conversation** with Gemini 2.5 Flash via the Live API WebSocket
- **Screen sharing & webcam** — give the AI visual context on demand
- **MCP server integration** — connect any [Model Context Protocol](https://modelcontextprotocol.io) server for tool use (filesystem, databases, external APIs, etc.)
- **Persistent memory** — global and per-workspace memory the AI carries across sessions
- **Custom personalities** — 5 built-in presets plus free-form system instructions
- **Session resumption** — reconnects with conversation context intact after drops
- **Live transcriptions** — optional real-time speech-to-text overlay
- **Altair/Vega charts** — Gemini can render interactive data visualizations inline
- **Global hotkey** — activate from any app with a configurable shortcut (default: `Alt+Shift+A`)
- **System tray + mini window** — stays out of your way until you need it
- **API key encrypted at rest** via Electron `safeStorage` (OS keychain)
- **No telemetry, no accounts, no backend**

---

## Requirements

- Node.js 18+
- A [Gemini API key](https://aistudio.google.com/app/apikey) — free tier is sufficient to get started
- Windows, macOS, or Linux

---

## Getting Started

```bash
git clone https://github.com/your-org/auralis.git
cd auralis
npm install
npm run electron:dev
```

On first launch you will be prompted to enter your Gemini API key. It is encrypted with `safeStorage` and stored locally — it is never sent anywhere other than directly to the Gemini API.

### Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | React dev server port |
| `AURALIS_ALLOW_INSECURE_CERTS` | `false` | Bypass TLS check for self-signed dev cert |

---

## Scripts

| Command | Description |
|---|---|
| `npm run electron:dev` | Start full dev environment (React dev server + Electron) |
| `npm run start` | React dev server only (HTTPS, port 3001) |
| `npm run build` | Production React bundle |
| `npm run electron:build` | Package distributable with electron-builder |
| `npm test` | Run tests |

---

## Architecture

```
Auralis/
├── public/                      # Electron main process
│   ├── electron.js              # Window management, IPC handlers, hotkeys, tray
│   ├── preload.js               # Context bridge — safe IPC surface for the renderer
│   ├── auth-manager.js          # Gemini API key encryption via safeStorage
│   ├── mcp-manager.js           # Spawns and communicates with MCP stdio servers
│   ├── memory-manager.js        # File-based memory (global + workspace-scoped)
│   └── skills-manager.js        # Custom skill/tool storage
└── src/                         # React renderer
    ├── App.tsx                  # Root: API key gate, LiveAPIProvider
    ├── config.ts                # Gemini tool declarations and system prompt
    ├── contexts/
    │   └── LiveAPIContext.tsx   # Provides WebSocket session to the component tree
    ├── hooks/
    │   └── use-live-api.ts     # Core: WebSocket lifecycle, audio, tool dispatch, reconnect
    ├── store/
    │   └── app-store.ts        # Zustand store — settings persisted to localStorage
    └── lib/
        ├── genai-live-client.ts # EventEmitter wrapper around the Gemini WebSocket
        ├── audio-recorder.ts   # Microphone capture with device selection
        ├── audio-streamer.ts   # Speaker output with volume and device routing
        └── personalities.ts    # 5 personality presets
```

**Data flow:** Microphone → `audio-recorder.ts` → `use-live-api.ts` → Gemini WebSocket → AI audio → `audio-streamer.ts` → speaker.

Tool calls are intercepted in `use-live-api.ts`, dispatched to the Electron main process via IPC or handled in-renderer, and results returned to Gemini.

**IPC contract:** defined by `preload.js`. The renderer calls `window.electronAPI.*` methods. New IPC channels must be registered in both `electron.js` (handler) and `preload.js` (bridge).

---

## MCP Servers

Enable **Experimental Features** in Settings to unlock the MCP tab. Add any stdio-transport MCP server — Auralis discovers its tools automatically and makes them available to the AI during sessions.

---

## Building for Distribution

```bash
npm run electron:build
```

Output goes to `/dist`. Targets are configured in the `build` section of `package.json` — adjust for your platform as needed.

---

## Privacy

- No telemetry, analytics, or external services of any kind.
- Your Gemini API key is encrypted at rest using the OS keychain.
- Audio streams directly to the Gemini API — no intermediate servers.
- Memory is stored as plain JSON in your local app data directory.

---

## Tech Stack

- **Electron** — desktop shell
- **React 18 + TypeScript** — renderer UI
- **Zustand** — state management
- **@google/genai** — Gemini Live API WebSocket client
- **@modelcontextprotocol/sdk** — MCP server communication
- **Vega / Vega-Lite** — inline chart rendering
- **SCSS** — styling

---

## License

[Apache 2.0](LICENSE)
