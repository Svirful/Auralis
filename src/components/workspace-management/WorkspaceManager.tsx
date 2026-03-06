import React, { useState, useEffect } from "react";
import { RiFolderOpenLine, RiAddLine, RiHistoryLine } from "react-icons/ri";
import cn from "classnames";
import "./workspace-management.scss";

interface Workspace {
  path: string;
  name: string;
  lastUsed?: string;
}

interface MemoryItem {
  id: string;
  text: string;
}

export const WorkspaceManager: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [globalMemory, setGlobalMemory] = useState<MemoryItem[]>([]);
  const [workspaceMemory, setWorkspaceMemory] = useState<MemoryItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const electron = (window as any).electron;
      if (electron) {
        if (electron.workspaces) {
          const wsData = await electron.workspaces.get();
          setWorkspaces(wsData.recent);
          setCurrentWorkspace(wsData.current);
        }
        if (electron.memory) {
          setGlobalMemory(await electron.memory.getGlobal());
          setWorkspaceMemory(await electron.memory.getWorkspace());
        }
      }
    };
    fetchData();
  }, [isOpen]); // Refresh when panel opens

  const handleAddWorkspace = async () => {
    const electron = (window as any).electron;
    if (electron?.workspaces) {
      const result = await electron.workspaces.select();
      if (result) {
        const data = await electron.workspaces.get();
        setWorkspaces(data.recent);
        setCurrentWorkspace(data.current);
      }
    }
  };

  const handleSelectWorkspace = async (path: string) => {
    const electron = (window as any).electron;
    if (electron?.workspaces) {
      await electron.workspaces.set(path);
      window.location.reload(); 
    }
  };

  const handleDeleteMemory = async (id: string) => {
    const electron = (window as any).electron;
    if (electron?.memory) {
      await electron.memory.delete(id);
      setGlobalMemory(await electron.memory.getGlobal());
      setWorkspaceMemory(await electron.memory.getWorkspace());
    }
  };

  return (
    <div className={cn("workspace-manager", { open: isOpen })}>
      <div className="workspace-dock">
        <button 
          className={cn("dock-item toggle", { active: isOpen })}
          onClick={() => setIsOpen(!isOpen)}
          title="Workspaces"
        >
          <RiFolderOpenLine size={24} />
        </button>
        <div className="dock-divider" />
        <button 
          className="dock-item add" 
          onClick={handleAddWorkspace}
          title="Add Workspace"
        >
          <RiAddLine size={24} />
        </button>
      </div>

      <div className="workspace-panel">
        <header>
          <h2>Workspaces</h2>
          <p>Organize your project memory</p>
        </header>

        <section className="current">
          <h3>Current</h3>
          {currentWorkspace ? (
            <div className="workspace-card active">
              <div className="info">
                <span className="name">{currentWorkspace.name}</span>
                <span className="path">{currentWorkspace.path}</span>
              </div>
            </div>
          ) : (
            <div className="no-workspace">No workspace selected</div>
          )}
        </section>

        <section className="recent">
          <h3>Recent</h3>
          <div className="workspace-list">
            {workspaces.filter(ws => ws.path !== currentWorkspace?.path).map((ws) => (
              <div 
                key={ws.path} 
                className="workspace-card"
                onClick={() => handleSelectWorkspace(ws.path)}
              >
                <RiHistoryLine className="icon" />
                <div className="info">
                  <span className="name">{ws.name}</span>
                  <span className="path">{ws.path}</span>
                </div>
              </div>
            ))}
            {workspaces.length <= (currentWorkspace ? 1 : 0) && (
              <div className="empty-state">No recent workspaces</div>
            )}
          </div>
        </section>

        <section className="memory">
          <h3>Memory</h3>
          <div className="memory-list">
            {globalMemory.map(item => (
              <div key={item.id} className="memory-item global">
                <span className="badge">Global</span>
                <span className="text">{item.text}</span>
                <button onClick={() => handleDeleteMemory(item.id)} className="delete">×</button>
              </div>
            ))}
            {workspaceMemory.map(item => (
              <div key={item.id} className="memory-item workspace">
                <span className="badge">Workspace</span>
                <span className="text">{item.text}</span>
                <button onClick={() => handleDeleteMemory(item.id)} className="delete">×</button>
              </div>
            ))}
            {globalMemory.length === 0 && workspaceMemory.length === 0 && (
              <div className="empty-state">No persistent memories yet</div>
            )}
          </div>
        </section>

        <footer>
          <button className="add-button" onClick={handleAddWorkspace}>
            <RiAddLine /> Add New Workspace
          </button>
        </footer>
      </div>
    </div>
  );
};
