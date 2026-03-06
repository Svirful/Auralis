const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');

class MemoryManager {
    constructor() {
        this.globalMemoryPath = path.join(app.getPath('userData'), 'global-memory.json');
        this.workspacesConfigPath = path.join(app.getPath('userData'), 'workspaces.json');
        this.currentWorkspacePath = null;

        this.globalMemory = this.loadJSON(this.globalMemoryPath, { items: [] });
        this.workspacesConfig = this.loadJSON(this.workspacesConfigPath, { recent: [], current: null });

        if (this.workspacesConfig.current) {
            this.currentWorkspacePath = this.workspacesConfig.current;
        }
    }

    loadJSON(filePath, defaultValue) {
        try {
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            }
        } catch (e) {
            console.error(`Failed to load JSON from ${filePath}:`, e);
        }
        return defaultValue;
    }

    saveJSON(filePath, data) {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        } catch (e) {
            console.error(`Failed to save JSON to ${filePath}:`, e);
        }
    }

    getGlobalMemory() {
        return this.globalMemory.items;
    }

    getWorkspaceMemory() {
        if (!this.currentWorkspacePath) return [];
        const memoryPath = path.join(this.currentWorkspacePath, '.auralis', 'memory.json');
        const data = this.loadJSON(memoryPath, { items: [] });
        return data.items;
    }

    addMemoryItem(scope, text) {
        const item = {
            id: Date.now().toString(),
            text,
            createdAt: new Date().toISOString()
        };

        if (scope === 'global') {
            this.globalMemory.items.push(item);
            this.saveJSON(this.globalMemoryPath, this.globalMemory);
        } else if (scope === 'workspace' && this.currentWorkspacePath) {
            const memoryPath = path.join(this.currentWorkspacePath, '.auralis', 'memory.json');
            const data = this.loadJSON(memoryPath, { items: [] });
            data.items.push(item);
            this.saveJSON(memoryPath, data);
        }
        return item;
    }

    deleteMemoryItem(id) {
        // Try global first
        const globalIdx = this.globalMemory.items.findIndex(i => i.id === id);
        if (globalIdx !== -1) {
            this.globalMemory.items.splice(globalIdx, 1);
            this.saveJSON(this.globalMemoryPath, this.globalMemory);
            return true;
        }

        // Try workspace
        if (this.currentWorkspacePath) {
            const memoryPath = path.join(this.currentWorkspacePath, '.auralis', 'memory.json');
            const data = this.loadJSON(memoryPath, { items: [] });
            const wsIdx = data.items.findIndex(i => i.id === id);
            if (wsIdx !== -1) {
                data.items.splice(wsIdx, 1);
                this.saveJSON(memoryPath, data);
                return true;
            }
        }
        return false;
    }

    async selectWorkspace() {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory']
        });

        if (!result.canceled && result.filePaths.length > 0) {
            const wsPath = result.filePaths[0];
            this.setWorkspace(wsPath);
            return { path: wsPath, name: path.basename(wsPath) };
        }
        return null;
    }

    setWorkspace(wsPath) {
        this.currentWorkspacePath = wsPath;
        this.workspacesConfig.current = wsPath;

        // Update recent list
        const existingIdx = this.workspacesConfig.recent.findIndex(w => w.path === wsPath);
        if (existingIdx !== -1) {
            this.workspacesConfig.recent.splice(existingIdx, 1);
        }
        this.workspacesConfig.recent.unshift({
            path: wsPath,
            name: path.basename(wsPath),
            lastUsed: new Date().toISOString()
        });

        // Keep only top 10
        if (this.workspacesConfig.recent.length > 10) {
            this.workspacesConfig.recent.pop();
        }

        this.saveJSON(this.workspacesConfigPath, this.workspacesConfig);
    }

    getWorkspaces() {
        return {
            recent: this.workspacesConfig.recent,
            current: this.currentWorkspacePath ? {
                path: this.currentWorkspacePath,
                name: path.basename(this.currentWorkspacePath)
            } : null
        };
    }

    async listWorkspaceFiles() {
        if (!this.currentWorkspacePath) return { error: "No workspace selected" };

        const results = [];
        const MAX_RESULTS = 1000;
        const workspaceRoot = path.resolve(this.currentWorkspacePath);
        const workspaceRootNorm = process.platform === 'win32'
            ? workspaceRoot.toLowerCase()
            : workspaceRoot;
        const isWithinWorkspace = (candidatePath) => {
            const resolved = path.resolve(candidatePath);
            const resolvedNorm = process.platform === 'win32'
                ? resolved.toLowerCase()
                : resolved;
            return resolvedNorm === workspaceRootNorm || resolvedNorm.startsWith(`${workspaceRootNorm}${path.sep}`);
        };

        const scan = (dir, relPath = "") => {
            if (results.length >= MAX_RESULTS) return;

            let items = [];
            try {
                items = fs.readdirSync(dir, { withFileTypes: true });
            } catch {
                return;
            }

            for (const item of items) {
                if (results.length >= MAX_RESULTS) break;

                const itemRelPath = path.join(relPath, item.name);
                if (item.name.startsWith('.') || item.name === "node_modules") continue;

                const itemFullPath = path.join(dir, item.name);
                if (!isWithinWorkspace(itemFullPath)) continue;

                let stats;
                try {
                    stats = fs.lstatSync(itemFullPath);
                } catch {
                    continue;
                }

                if (stats.isSymbolicLink()) continue;

                if (stats.isDirectory()) {
                    results.push({ name: item.name, type: "directory", path: itemRelPath });
                    scan(itemFullPath, itemRelPath);
                } else if (stats.isFile()) {
                    results.push({ name: item.name, type: "file", path: itemRelPath });
                }
            }
        };

        try {
            scan(workspaceRoot);
            return { files: results };
        } catch (e) {
            return { error: e.message };
        }
    }

    async getFileMetadata(filePath) {
        if (!this.currentWorkspacePath) return { error: "No workspace selected" };

        const workspaceRoot = path.resolve(this.currentWorkspacePath);
        const requestedPath = path.isAbsolute(filePath)
            ? path.resolve(filePath)
            : path.resolve(workspaceRoot, filePath);
        const workspaceRootNorm = process.platform === 'win32'
            ? workspaceRoot.toLowerCase()
            : workspaceRoot;
        const requestedNorm = process.platform === 'win32'
            ? requestedPath.toLowerCase()
            : requestedPath;

        if (!(requestedNorm === workspaceRootNorm || requestedNorm.startsWith(`${workspaceRootNorm}${path.sep}`))) {
            return { error: "Access denied: Path is outside workspace" };
        }

        try {
            const stats = fs.statSync(requestedPath);
            return {
                name: path.basename(requestedPath),
                size: stats.size,
                type: stats.isDirectory() ? "directory" : "file",
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime,
                extension: path.extname(requestedPath)
            };
        } catch (e) {
            return { error: e.message };
        }
    }
}

module.exports = MemoryManager;
