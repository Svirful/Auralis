import React, { useEffect, useState, useCallback } from 'react';
import cn from 'classnames';

interface MCPServerConfig {
  disabled?: boolean;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

interface MCPTool {
    name: string;
    description?: string;
    inputSchema?: any;
    serverName?: string;
}

interface PendingImport {
  parsedJson: string;
  servers: Array<{ name: string; command: string; args: string[] }>;
}

export default function MCPSettings() {
  const [config, setConfig] = useState<MCPConfig | null>(null);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState("");
  const [statusMsg, setStatusMsg] = useState<{type: 'success'|'error', msg: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  const electron = (window as any).electron;

  const loadData = useCallback(async () => {
    if (electron && electron.mcp) {
      try {
        const conf = await electron.mcp.getConfig();
        setConfig(conf);
        const tls = await electron.mcp.getTools();
        setTools(tls);
        
        // Select first server if none selected
        if (!selectedServer && conf && conf.mcpServers) {
             const keys = Object.keys(conf.mcpServers);
             if (keys.length > 0) setSelectedServer(keys[0]);
        }
      } catch (e) {
        console.error("Failed to load MCP data", e);
      }
    }
  }, [electron, selectedServer]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleServer = async (name: string, currentDisabled: boolean) => {
      if (!config) return;
      const newConfig = { ...config };
      if (!newConfig.mcpServers[name]) return;
      
      newConfig.mcpServers[name].disabled = !currentDisabled;
      
      await electron.mcp.setConfig(newConfig);
      await loadData();
  };

  // Step 1: parse the JSON and show a confirmation with the commands that will run.
  const handleJsonSubmit = () => {
      if (!jsonInput.trim()) return;
      let parsed: any;
      try {
          parsed = JSON.parse(jsonInput);
      } catch {
          setStatusMsg({ type: 'error', msg: 'Invalid JSON — please check the format.' });
          setTimeout(() => setStatusMsg(null), 3000);
          return;
      }
      if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
          setStatusMsg({ type: 'error', msg: 'Invalid config: missing "mcpServers" key.' });
          setTimeout(() => setStatusMsg(null), 3000);
          return;
      }
      const servers = Object.entries(parsed.mcpServers as Record<string, MCPServerConfig>).map(
          ([name, cfg]) => ({
              name,
              command: cfg.command || '(no command)',
              args: cfg.args || [],
          })
      );
      setPendingImport({ parsedJson: jsonInput, servers });
  };

  // Step 2: user confirmed — actually import.
  const handleConfirmImport = async () => {
      if (!pendingImport) return;
      setIsLoading(true);
      setPendingImport(null);
      try {
          const res = await electron.mcp.addServerJson(pendingImport.parsedJson);
          if (res.success) {
              setStatusMsg({ type: 'success', msg: 'Server added successfully' });
              setJsonInput("");
              await loadData();
          } else {
              setStatusMsg({ type: 'error', msg: res.error || 'Failed to add server' });
          }
      } catch (e: any) {
          setStatusMsg({ type: 'error', msg: e.message });
      } finally {
          setIsLoading(false);
      }
      setTimeout(() => setStatusMsg(null), 3000);
  };

  const serverNames = config ? Object.keys(config.mcpServers) : [];
  
  // Resilient tool filtering: match by serverName or show all if no server metadata present
  const selectedServerTools = tools.filter(t => 
    t.serverName === selectedServer || !t.serverName
  );

  useEffect(() => {
    if (tools.length > 0) {
        console.log(`[MCP] UI: Found ${tools.length} total tools. ${selectedServerTools.length} match ${selectedServer}`);
    }
  }, [tools, selectedServer, selectedServerTools.length]);

  // Confirmation overlay rendered when the user has clicked "Import Server"
  // and we are waiting for them to approve the commands that will be executed.
  const ConfirmDialog = pendingImport && (
      <div className="mcp-confirm-overlay">
          <div className="mcp-confirm-dialog">
              <span className="material-symbols-outlined mcp-confirm-icon">warning</span>
              <h3>Security Warning</h3>
              <p>
                  Importing this config will execute the following system{' '}
                  {pendingImport.servers.length === 1 ? 'command' : 'commands'} on your machine.{' '}
                  <strong>Only proceed if you trust the source.</strong>
              </p>
              <div className="mcp-confirm-commands">
                  {pendingImport.servers.map(s => (
                      <div key={s.name} className="mcp-confirm-command-row">
                          <span className="mcp-confirm-server-name">{s.name}</span>
                          <code>{[s.command, ...s.args].join(' ')}</code>
                      </div>
                  ))}
              </div>
              <div className="mcp-confirm-actions">
                  <button className="action-button secondary" onClick={() => setPendingImport(null)}>
                      Cancel
                  </button>
                  <button className="action-button danger" onClick={handleConfirmImport}>
                      I trust this — Import
                  </button>
              </div>
          </div>
      </div>
  );

  return (
    <div className="mcp-settings">
      {ConfirmDialog}
      <div className="mcp-sidebar">
        <h3>Connected Servers</h3>
        <ul>
            {serverNames.map(name => (
                <li 
                    key={name} 
                    className={cn({ active: selectedServer === name })}
                    onClick={() => setSelectedServer(name)}
                >
                    <span className="server-name">{name}</span>
                    <span className={cn("status-dot", { disabled: config?.mcpServers[name].disabled })}></span>
                </li>
            ))}
        </ul>
        <div className="add-server-section">
            <h4>Add New Server</h4>
            <textarea 
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='Paste config JSON here...'
                spellCheck={false}
            />
            <button onClick={handleJsonSubmit} className="action-button" disabled={isLoading}>
              {isLoading ? 'Importing Server...' : 'Import Server'}
            </button>
            {statusMsg && <div className={cn("status-msg", statusMsg.type)}>{statusMsg.msg}</div>}
        </div>
      </div>
      <div className="mcp-content">
          {selectedServer && config?.mcpServers[selectedServer] ? (
              <>
                <div className="server-header">
                    <h3>{selectedServer}</h3>
                    <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--neutral-60)', fontWeight: 500 }}>
                        {config.mcpServers[selectedServer].disabled ? 'Server is offline' : 'Server is active'}
                      </span>
                      <label className="toggle-switch">
                          <input
                              type="checkbox"
                              checked={!config.mcpServers[selectedServer].disabled}
                              onChange={() => toggleServer(selectedServer, !!config.mcpServers[selectedServer].disabled)}
                          />
                          <span className="slider"></span>
                      </label>
                    </div>
                </div>
                <div className="tools-list">
                    <h4>Available Capabilities</h4>
                    {selectedServerTools.length === 0 ? (
                        <p className="no-tools">
                            {config.mcpServers[selectedServer].disabled 
                                ? "Enable the server to discover available tools and resources." 
                                : "No tools found for this server configuration."}
                        </p>
                    ) : (
                        selectedServerTools.map((tool, idx) => (
                            <div key={idx} className="tool-item">
                                <div className="tool-info">
                                    <span className="tool-name">{tool.name}</span>
                                    <span className="tool-desc">{tool.description || "No description provided."}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
              </>
          ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '4rem', marginBottom: '1rem' }}>hub</span>
                  <p>Select a server to view its tools and configuration</p>
              </div>
          )}
      </div>
    </div>
  );
}
