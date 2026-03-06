import {
  ChangeEvent,
  useCallback,
  useMemo,
  useState,
  useEffect,
} from "react";
import "./settings-dialog.scss";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { useAppStore } from "../../store/app-store";
import VoiceSelector from "./VoiceSelector";
import ResponseModalitySelector from "./ResponseModalitySelector";
import AudioDeviceSelector from "./AudioDeviceSelector";
import { LiveConnectConfig } from "@google/genai";
import cn from "classnames";
import MCPSettings from "./MCPSettings";
import SkillsSettings from "./SkillsSettings";
import "./mcp-settings.scss";
import PersonalitySelector from "./PersonalitySelector";
import StatsTab from "./StatsTab";
import KeybindRecorder from "./KeybindRecorder";


export default function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'general' | 'mcp' | 'skills' | 'stats'>('general');
  // Removed apiKey from context destructure
  const { 
    config, setConfig, connected,
    audioInputDeviceId, setAudioInputDeviceId,
    audioOutputDeviceId, setAudioOutputDeviceId,
    showDeveloperPanel, setShowDeveloperPanel,
    outputVolume, setOutputVolume,
    enableAffectiveDialog, setEnableAffectiveDialog,
    enableProactiveAudio, setEnableProactiveAudio,
    enableTranscriptions, setEnableTranscriptions,
    userInstructions, setUserInstructions,
    experimentalFeatures, setExperimentalFeatures
  } = useLiveAPIContext();

  const { geminiApiKey, setGeminiApiKey } = useAppStore();
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');

  const [localConfig, setLocalConfig] = useState<LiveConnectConfig>(config);
  // Removed localApiKey
  const [localAudioInputDeviceId, setLocalAudioInputDeviceId] = useState(audioInputDeviceId);
  const [localAudioOutputDeviceId, setLocalAudioOutputDeviceId] = useState(audioOutputDeviceId);
  const [localShowDeveloperPanel, setLocalShowDeveloperPanel] = useState(showDeveloperPanel);
  const [localEnableAffectiveDialog, setLocalEnableAffectiveDialog] = useState(enableAffectiveDialog);
  const [localEnableProactiveAudio, setLocalEnableProactiveAudio] = useState(enableProactiveAudio);
  const [localEnableTranscriptions, setLocalEnableTranscriptions] = useState(enableTranscriptions);
  const [localUserInstructions, setLocalUserInstructions] = useState(userInstructions);
  const [localExperimentalFeatures, setLocalExperimentalFeatures] = useState(experimentalFeatures);

  useEffect(() => {
    if (open) {
      setLocalConfig(config);
      setLocalAudioInputDeviceId(audioInputDeviceId);
      setLocalAudioOutputDeviceId(audioOutputDeviceId);
      setLocalShowDeveloperPanel(showDeveloperPanel);
      setLocalEnableAffectiveDialog(enableAffectiveDialog);
      setLocalEnableProactiveAudio(enableProactiveAudio);
      setLocalEnableTranscriptions(enableTranscriptions);
      setLocalUserInstructions(userInstructions);
      setLocalExperimentalFeatures(experimentalFeatures);
    }
  }, [open, config, audioInputDeviceId, audioOutputDeviceId, showDeveloperPanel, enableAffectiveDialog, enableProactiveAudio, enableTranscriptions, experimentalFeatures]);

  useEffect(() => {
    const handleOpenSettings = () => {
      setOpen(true);
      setTab('general');
    };
    window.addEventListener("open-settings", handleOpenSettings);
    return () => window.removeEventListener("open-settings", handleOpenSettings);
  }, []);


  const handleUserInstructionsChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setLocalUserInstructions(event.target.value);
    },
    []
  );

  const handleSaveApiKey = async () => {
    const trimmed = newApiKey.trim();
    if (!trimmed) return;
    const electron = (window as any).electron;
    if (electron?.auth?.saveApiKey) {
      await electron.auth.saveApiKey(trimmed);
    }
    setGeminiApiKey(trimmed);
    setNewApiKey('');
    setShowApiKeyInput(false);
  };

  const handleSave = () => {
    setConfig(localConfig);
    setAudioInputDeviceId(localAudioInputDeviceId);
    setAudioOutputDeviceId(localAudioOutputDeviceId);
    setShowDeveloperPanel(localShowDeveloperPanel);
    setEnableAffectiveDialog(localEnableAffectiveDialog);
    setEnableProactiveAudio(localEnableProactiveAudio);
    setEnableTranscriptions(localEnableTranscriptions);
    setUserInstructions(localUserInstructions);
    setExperimentalFeatures(localExperimentalFeatures);
    
    // If we're turning off experimental features and currently on mcp or skills tab, switch to general
    if (!localExperimentalFeatures && (tab === 'mcp' || tab === 'skills')) {
      setTab('general');
    }
    
    setOpen(false);
  };

  return (
    <>
      <button
        className="action-button material-symbols-outlined settings-button"
        onClick={() => { setOpen(!open); setTab('general'); }}
      >
        settings
      </button>
      <div className={cn("settings-panel", { open, wide: true })}>
        <div className="settings-panel-container" style={{ maxWidth: '100%', transition: 'max-width 0.3s' }}>
          <div className="panel-header">
            <div className="tabs-navigation" style={{display: 'flex', gap: '2rem', alignItems: 'center'}}>
                <h2 
                    onClick={() => setTab('general')} 
                    className={cn("tab-title", { active: tab === 'general' })}
                    style={{
                        cursor: 'pointer', 
                        opacity: tab === 'general' ? 1 : 0.4,
                        position: 'relative',
                        paddingBottom: '0.5rem',
                        transition: 'all 0.3s ease'
                    }}
                >
                  General
                  {tab === 'general' && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: 'var(--blue-500)', borderRadius: '3px' }} />}
                </h2>
                <h2 
                    onClick={() => setTab('stats')} 
                    className={cn("tab-title", { active: tab === 'stats' })}
                    style={{
                        cursor: 'pointer', 
                        opacity: tab === 'stats' ? 1 : 0.4,
                        position: 'relative',
                        paddingBottom: '0.5rem',
                        transition: 'all 0.3s ease'
                    }}
                >
                  Stats
                  {tab === 'stats' && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: 'var(--blue-500)', borderRadius: '3px' }} />}
                </h2>
                {localExperimentalFeatures && (
                  <>
                    <h2 
                        onClick={() => setTab('mcp')} 
                        className={cn("tab-title", { active: tab === 'mcp' })}
                        style={{
                            cursor: 'pointer', 
                            opacity: tab === 'mcp' ? 1 : 0.4,
                            position: 'relative',
                            paddingBottom: '0.5rem',
                            transition: 'all 0.3s ease'
                        }}
                    >
                      MCP Servers
                      {tab === 'mcp' && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: 'var(--blue-500)', borderRadius: '3px' }} />}
                    </h2>
                    <h2 
                        onClick={() => setTab('skills')} 
                        className={cn("tab-title", { active: tab === 'skills' })}
                        style={{
                            cursor: 'pointer', 
                            opacity: tab === 'skills' ? 1 : 0.4,
                            position: 'relative',
                            paddingBottom: '0.5rem',
                            transition: 'all 0.3s ease'
                        }}
                    >
                      Skills
                      {tab === 'skills' && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: 'var(--blue-500)', borderRadius: '3px' }} />}
                    </h2>
                  </>
                )}
            </div>
            <button className="close-button" onClick={() => setOpen(false)}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {tab === 'mcp' ? (
              <div className={cn("panel-body", { disabled: connected })} style={{ padding: 0 }}>
                  <MCPSettings />
              </div>
          ) : tab === 'skills' ? (
              <div className={cn("panel-body", { disabled: connected })} style={{ padding: 0 }}>
                  <SkillsSettings />
              </div>
          ) : tab === 'stats' ? (
              <div className="panel-body" style={{ padding: 0 }}>
                  <StatsTab />
              </div>
          ) : (
          <>
          <div className={cn("panel-body", { disabled: connected, "general-tab-body": tab === 'general' })}>
            <div className="top-row-group">
                <div className="settings-section-card section-account">
                  <div className="account-info">
                    <label>API Key</label>
                    <div className="user-details">
                      <span className="material-symbols-outlined">key</span>
                      <span className="email-text">
                        {geminiApiKey
                          ? `${geminiApiKey.substring(0, 8)}••••••••`
                          : 'No API key set'}
                      </span>
                    </div>
                  </div>
                  {showApiKeyInput ? (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="password"
                        placeholder="AIza..."
                        value={newApiKey}
                        onChange={(e) => setNewApiKey(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
                        style={{
                          padding: '0.4rem 0.75rem',
                          borderRadius: '8px',
                          border: '1px solid var(--neutral-20)',
                          background: 'var(--neutral-10)',
                          color: 'var(--neutral-90)',
                          fontSize: '0.85rem',
                          width: '160px',
                        }}
                      />
                      <button onClick={handleSaveApiKey} className="logout-button" style={{ whiteSpace: 'nowrap' }}>
                        Save
                      </button>
                      <button onClick={() => { setShowApiKeyInput(false); setNewApiKey(''); }} className="logout-button">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setShowApiKeyInput(true)} className="logout-button">
                      <span className="material-symbols-outlined">edit</span>
                      Change
                    </button>
                  )}
                </div>

                <div className="settings-section-card section-volume">
                  <div className="volume-control">
                    <span className="material-symbols-outlined">
                        {outputVolume === 0 ? 'volume_off' : outputVolume < 0.5 ? 'volume_down' : 'volume_up'}
                    </span>
                    <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.01" 
                        value={outputVolume} 
                        onChange={(e) => setOutputVolume(parseFloat(e.target.value))}
                    />
                    <span className="percentage-text">
                        {Math.round(outputVolume * 100)}%
                    </span>
                  </div>
                </div>
            </div>

            {connected && (
              <div className="connected-indicator glass-alert" style={{ gridColumn: 'span 2' }}>
                <p>
                  Settings are locked during an active session to ensure stability.
                  Please disconnect to make changes.
                </p>
              </div>
            )}

            <div className="settings-section-card section-streaming">
              <h3>Streaming Configuration</h3>
              <div className="mode-selectors">
                <VoiceSelector />
                <AudioDeviceSelector 
                  label="Microphone" 
                  kind="audioinput" 
                  selectedDeviceId={localAudioInputDeviceId}
                  onDeviceChange={setLocalAudioInputDeviceId}
                />
                <AudioDeviceSelector 
                  label="Speaker" 
                  kind="audiooutput" 
                  selectedDeviceId={localAudioOutputDeviceId}
                  onDeviceChange={setLocalAudioOutputDeviceId}
                />
              </div>
            </div>

            <div className="settings-section-card section-enhancements">
              <h3>Experience Enhancements</h3>
              <div className="experience-options">
                <div className="setting-row" title="Enables emotion-aware voice responses based on your tone of voice.">
                  <div className="label-group">
                    <label>Affective Dialog</label>
                    <span>Dynamic emotional responsiveness</span>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={localEnableAffectiveDialog}
                      onChange={(e) => setLocalEnableAffectiveDialog(e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>

                <div className="setting-row" title="Enables Aura to intelligently decide when to interject or remain silent.">
                  <div className="label-group">
                    <label>Proactive Audio</label>
                    <span>Intelligent interjection model</span>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={localEnableProactiveAudio}
                      onChange={(e) => setLocalEnableProactiveAudio(e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>

                <div className="setting-row" title="Show live text of what both you and the model are saying in the chat window.">
                  <div className="label-group">
                    <label>Live Transcriptions</label>
                    <span>Real-time speech-to-text</span>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={localEnableTranscriptions}
                      onChange={(e) => setLocalEnableTranscriptions(e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            </div>

            <div className="settings-section-card section-identity">
              <h3>Personality & Instructions</h3>
              <PersonalitySelector disabled={connected} />
              <textarea
                className="system"
                placeholder="Add specific instructions for the AI (e.g., 'speak like a pirate', 'be concise')..."
                onChange={handleUserInstructionsChange}
                value={localUserInstructions}
              />
            </div>

            <div className="settings-section-card section-hotkey">
              <h3>Activation Shortcut</h3>
              <KeybindRecorder disabled={connected} />
            </div>

            <div className="settings-section-card section-debug">
              <h3>Developer Settings</h3>
              <div className="setting-row">
                  <div className="label-group">
                    <label>Extended Logging</label>
                    <span>Detailed internal system logs</span>
                  </div>
                  <label className="toggle-switch">
                  <input
                      type="checkbox"
                      checked={localShowDeveloperPanel}
                      onChange={(e) => {
                      const value = e.target.checked;
                      setLocalShowDeveloperPanel(value);
                      setShowDeveloperPanel(value);
                      }}
                  />
                  <span className="slider"></span>
                  </label>
              </div>

              <div className="setting-row" title="Enables Experimental Features like MCP Servers and Skills.">
                  <div className="label-group">
                    <label>Experimental Features</label>
                    <span>Enable advanced/beta capabilities</span>
                  </div>
                  <label className="toggle-switch">
                  <input
                      type="checkbox"
                      checked={localExperimentalFeatures}
                      onChange={(e) => {
                        const value = e.target.checked;
                        setLocalExperimentalFeatures(value);
                      }}
                  />
                  <span className="slider"></span>
                  </label>
              </div>
            </div>
          </div>
          <div className="panel-footer">
            <button
              className="action-button save-button"
              onClick={handleSave}
              disabled={connected}
            >
              Apply Changes
            </button>
          </div>

          </>
          )}
        </div>
      </div>
    </>
  );
}