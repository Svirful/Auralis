import { useState, useEffect, useCallback, useRef } from "react";

export interface HotkeyConfig {
  modifiers: { ctrl: boolean; alt: boolean; shift: boolean; meta: boolean };
  /** UiohookKey enum name e.g. 'A', 'F1', 'Space'. Null when mouseButton is set. */
  uiohookKey: string | null;
  /** uiohook-napi button number. Null when uiohookKey is set. */
  mouseButton: number | null;
  /** Human-readable label shown in UI e.g. "Alt + Shift + A" */
  display: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta"]);

/** Browser mousedown.button → uiohook-napi button number */
const BROWSER_TO_UIOHOOK_BUTTON: Record<number, number> = {
  0: 1, // left   → LMB
  1: 3, // middle → MMB
  2: 2, // right  → RMB
  3: 4, // back
  4: 5, // forward
};

const MOUSE_BUTTON_DISPLAY: Record<number, string> = {
  0: "Left Click",
  1: "Middle Click",
  2: "Right Click",
  3: "Mouse Back",
  4: "Mouse Forward",
};

const SUPPORTED_CODES = new Set([
  "Space", "Enter", "Backspace", "Tab", "Escape",
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "Home", "End", "Insert", "Delete", "PageUp", "PageDown",
  "F1", "F2", "F3", "F4", "F5", "F6",
  "F7", "F8", "F9", "F10", "F11", "F12",
  "Digit0", "Digit1", "Digit2", "Digit3", "Digit4",
  "Digit5", "Digit6", "Digit7", "Digit8", "Digit9",
]);

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Convert browser KeyboardEvent.code → UiohookKey enum name */
function codeToUiohookName(code: string): string | null {
  if (code.startsWith("Key")) return code.slice(3); // KeyA → A
  if (SUPPORTED_CODES.has(code)) return code;
  return null;
}

/** Prettier display for a UiohookKey name */
function uiohookNameToDisplay(name: string): string {
  if (name.startsWith("Digit")) return name.slice(5); // Digit0 → 0
  return name;
}

function buildDisplay(
  mods: HotkeyConfig["modifiers"],
  key: string | null,
  mouseBtn: number | null
): string {
  const parts: string[] = [];
  if (mods.ctrl)  parts.push("Ctrl");
  if (mods.alt)   parts.push("Alt");
  if (mods.shift) parts.push("Shift");
  if (mods.meta)  parts.push("Meta");
  if (key !== null)       parts.push(uiohookNameToDisplay(key));
  if (mouseBtn !== null) {
    const browserBtn = Object.entries(BROWSER_TO_UIOHOOK_BUTTON).find(([, v]) => v === mouseBtn);
    parts.push(
      browserBtn ? MOUSE_BUTTON_DISPLAY[Number(browserBtn[0])] : `Mouse${mouseBtn}`
    );
  }
  return parts.join(" + ");
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  disabled?: boolean;
}

export default function KeybindRecorder({ disabled = false }: Props) {
  const electron = (window as any).electron;
  const [config, setConfig] = useState<HotkeyConfig | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef(false);

  // Load config from main process on mount
  useEffect(() => {
    if (!electron?.hotkey) return;
    electron.hotkey
      .getConfig()
      .then((cfg: HotkeyConfig) => setConfig(cfg))
      .catch(() =>
        setConfig({
          modifiers: { ctrl: false, alt: true, shift: true, meta: false },
          uiohookKey: "A",
          mouseButton: null,
          display: "Alt + Shift + A",
        })
      );
  }, [electron]);

  const cancelRecording = useCallback(() => {
    setRecording(false);
    recordingRef.current = false;
    setError(null);
  }, []);

  const applyConfig = useCallback(
    async (newConfig: HotkeyConfig) => {
      if (!electron?.hotkey) return;
      try {
        await electron.hotkey.setConfig(newConfig);
        setConfig(newConfig);
        setError(null);
      } catch {
        setError("Failed to save shortcut. Please try again.");
      } finally {
        setRecording(false);
        recordingRef.current = false;
      }
    },
    [electron]
  );

  // Capture keyboard / mouse events while recording
  useEffect(() => {
    if (!recording) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!recordingRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") { cancelRecording(); return; }
      if (MODIFIER_KEYS.has(e.key)) return; // wait for a real key

      const uiohookKey = codeToUiohookName(e.code);
      if (!uiohookKey) return;

      const mods = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey };
      applyConfig({
        modifiers: mods,
        uiohookKey,
        mouseButton: null,
        display: buildDisplay(mods, uiohookKey, null),
      });
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!recordingRef.current) return;
      // Plain left-click with no modifiers: likely "Cancel" click – ignore
      if (e.button === 0 && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) return;

      e.preventDefault();
      e.stopPropagation();

      const uiohookButton = BROWSER_TO_UIOHOOK_BUTTON[e.button];
      if (uiohookButton === undefined) return;

      const mods = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey };
      applyConfig({
        modifiers: mods,
        uiohookKey: null,
        mouseButton: uiohookButton,
        display: buildDisplay(mods, null, uiohookButton),
      });
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("mousedown", onMouseDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("mousedown", onMouseDown, true);
    };
  }, [recording, cancelRecording, applyConfig]);

  const startRecording = () => {
    if (disabled) return;
    setError(null);
    setRecording(true);
    recordingRef.current = true;
  };

  // Not running in Electron – hide gracefully
  if (!electron?.hotkey) return null;

  const displayParts = (config?.display ?? "Not set").split(" + ");

  return (
    <div className="keybind-recorder">
      {recording ? (
        <div className="keybind-recording-state">
          <span className="keybind-listening-label">
            <span className="keybind-pulse" />
            Press any combination… <kbd>Esc</kbd> to cancel
          </span>
          <button
            className="keybind-cancel-btn"
            onMouseDown={(e) => { e.stopPropagation(); cancelRecording(); }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="keybind-display-row">
          <div className="keybind-badge-row">
            {displayParts.map((part, i) => (
              <span key={i} className="keybind-key-badge">{part}</span>
            ))}
          </div>
          <button
            className="keybind-change-btn"
            onClick={startRecording}
            disabled={disabled}
          >
            Change
          </button>
        </div>
      )}
      {error && <p className="keybind-error">{error}</p>}
    </div>
  );
}
