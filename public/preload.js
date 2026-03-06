const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    getSources: () => ipcRenderer.invoke('get-sources'),
    getActiveDisplaySource: () => ipcRenderer.invoke('get-active-display-source'),
    showScreenOverlay: () => ipcRenderer.invoke('show-screen-overlay'),
    hideScreenOverlay: () => ipcRenderer.invoke('hide-screen-overlay'),
    setSelectedSource: (id) => ipcRenderer.send('set-selected-source', id),
    onHotkeyTriggered: (callback) => {
        const sub = (event, sourceId) => callback(sourceId);
        ipcRenderer.on('hotkey-triggered', sub);
        return () => ipcRenderer.removeListener('hotkey-triggered', sub);
    },
    sendMainWindowCommand: (cmd, data) => ipcRenderer.send('main-window-command', { cmd, data }),
    onMainWindowCommand: (callback) => {
        const sub = (event, { cmd, data }) => callback(cmd, data);
        ipcRenderer.on('main-window-command', sub);
        return () => ipcRenderer.removeListener('main-window-command', sub);
    },
    setMiniWindowActive: (active) => ipcRenderer.send('set-mini-window-active', active),
    isMini: window.location.search.includes('mode=mini'),
    mcp: {
        getTools: () => ipcRenderer.invoke('mcp-get-tools'),
        callTool: (name, args) => ipcRenderer.invoke('mcp-call-tool', { name, args }),
        getConfig: () => ipcRenderer.invoke('mcp-get-config'),
        setConfig: (config) => ipcRenderer.invoke('mcp-set-config', config),
        addServerJson: (json) => ipcRenderer.invoke('mcp-add-server-json', json)
    },
    skills: {
        getAll: () => ipcRenderer.invoke('skills-get-all'),
        save: (skillData) => ipcRenderer.invoke('skills-save', skillData),
        delete: (id) => ipcRenderer.invoke('skills-delete', { id })
    },
    memory: {
        getGlobal: () => ipcRenderer.invoke('memory-get-global'),
        getWorkspace: () => ipcRenderer.invoke('memory-get-workspace'),
        add: (scope, text) => ipcRenderer.invoke('memory-add', { scope, text }),
        delete: (id) => ipcRenderer.invoke('memory-delete', { id }),
        listFiles: () => ipcRenderer.invoke('memory-list-files'),
        getMetadata: (path) => ipcRenderer.invoke('memory-get-metadata', { path })
    },
    workspaces: {
        get: () => ipcRenderer.invoke('workspaces-get'),
        select: () => ipcRenderer.invoke('workspaces-select'),
        set: (path) => ipcRenderer.invoke('workspaces-set', { path })
    },
    // Generic invoke removed for security. Use specific bridge methods.
    auth: {
        getApiKey: () => ipcRenderer.invoke('auth-get-api-key'),
        saveApiKey: (key) => ipcRenderer.invoke('auth-save-api-key', key),
    },
    hotkey: {
        getConfig: () => ipcRenderer.invoke('hotkey-get-config'),
        setConfig: (config) => ipcRenderer.invoke('hotkey-set-config', config),
    },
    openExternal: (url) => ipcRenderer.send('open-external', url),
});
