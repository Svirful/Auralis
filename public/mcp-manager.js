const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const path = require("path");
const fs = require("fs");
const { app } = require("electron");

class MCPManager {
    constructor() {
        this.servers = {}; // serverName -> { client, transport, config }
        this.toolCache = {}; // sanitizedName -> { serverName, originalName }
        this.configPath = path.join(app.getPath("userData"), "mcp-servers.json");
        this.config = { mcpServers: {} };
        this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, "utf-8");
                this.config = JSON.parse(data);
                if (!this.config.mcpServers) this.config.mcpServers = {};
            }
        } catch (e) {
            console.error("Failed to load MCP config:", e);
        }
    }

    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (e) {
            console.error("Failed to save MCP config:", e);
        }
    }

    async initialize() {
        console.log("Initializing MCP Servers...");
        for (const [name, serverConfig] of Object.entries(this.config.mcpServers)) {
            if (!serverConfig.disabled) {
                await this.connectServer(name, serverConfig);
            }
        }
    }

    async connectServer(name, serverConfig) {
        console.log(`Connecting to MCP server: ${name}`);
        try {
            const transport = new StdioClientTransport({
                command: serverConfig.command,
                args: serverConfig.args || [],
                env: { ...process.env, ...(serverConfig.env || {}) },
            });

            const client = new Client(
                {
                    name: "AuralisClient",
                    version: "1.0.0",
                },
                {
                    capabilities: {
                        sampling: {},
                    },
                }
            );

            await client.connect(transport);

            this.servers[name] = {
                client,
                transport,
                config: serverConfig
            };

            console.log(`Connected to ${name}`);
        } catch (e) {
            console.error(`Failed to connect to ${name}:`, e);
        }
    }

    async stopServer(name) {
        const server = this.servers[name];
        if (server) {
            try {
                await server.client.close();
                // Transport close is often handled by client close, but good to be sure
                await server.transport.close();
            } catch (e) {
                console.error(`Error stopping ${name}:`, e);
            }
            delete this.servers[name];
        }
    }

    async getTools() {
        let allTools = [];
        this.toolCache = {}; // Clear and rebuild cache

        for (const [serverName, server] of Object.entries(this.servers)) {
            try {
                const result = await server.client.listTools();
                const tools = result.tools.map(tool => {
                    const sanitizedName = tool.name.replace(/[^a-zA-Z0-9_]/g, '_');
                    console.log(`[MCP] Processing tool: ${tool.name} -> ${sanitizedName}`);

                    // Deep sanitize function: converts hyphens to underscores in object KEYS only.
                    // The 'required' array is a special case — its items are property name references,
                    // so they must also be sanitized to match the sanitized keys.
                    // All other string values (descriptions, enums, URLs, etc.) are left untouched.
                    const deepSanitize = (obj) => {
                        if (Array.isArray(obj)) {
                            return obj.map(deepSanitize);
                        }
                        if (obj !== null && typeof obj === 'object') {
                            const newObj = {};
                            for (let [k, v] of Object.entries(obj)) {
                                const sanitizedKey = k.replace(/-/g, '_');
                                if (sanitizedKey === 'required' && Array.isArray(v)) {
                                    // 'required' values are property name references — sanitize them
                                    // to match the sanitized property keys above.
                                    newObj[sanitizedKey] = v.map(item =>
                                        typeof item === 'string' ? item.replace(/-/g, '_') : item
                                    );
                                } else {
                                    newObj[sanitizedKey] = deepSanitize(v);
                                }
                            }
                            return newObj;
                        }
                        // Strings and primitives: return as-is
                        return obj;
                    };

                    const sanitizedDescription = deepSanitize(tool.description || `Execute ${tool.name}`);
                    const sanitizedSchema = deepSanitize(tool.inputSchema || { type: 'object', properties: {} });

                    this.toolCache[sanitizedName] = {
                        serverName,
                        originalName: tool.name
                    };

                    return {
                        name: sanitizedName,
                        description: sanitizedDescription,
                        inputSchema: sanitizedSchema,
                        serverName: serverName
                    };
                });
                allTools = allTools.concat(tools);
            } catch (e) {
                console.error(`Error listing tools for ${serverName}:`, e);
            }
        }
        return allTools;
    }

    async callTool(sanitizedName, args) {
        console.log(`[MCP] Received call for: ${sanitizedName}`);

        // 1. Check cache first
        const cacheEntry = this.toolCache ? this.toolCache[sanitizedName] : null;
        if (cacheEntry) {
            const server = this.servers[cacheEntry.serverName];
            if (server) {
                console.log(`[MCP] Routing ${sanitizedName} to ${cacheEntry.serverName} as ${cacheEntry.originalName}`);
                return await server.client.callTool({
                    name: cacheEntry.originalName,
                    arguments: args
                });
            }
        }

        // 2. Fallback (re-scan) if cache empty or tool not found
        for (const [serverName, server] of Object.entries(this.servers)) {
            try {
                const result = await server.client.listTools();
                const tool = result.tools.find(t => {
                    const sn = t.name.replace(/[^a-zA-Z0-9_]/g, '_');
                    return sn === sanitizedName || t.name === sanitizedName;
                });

                if (tool) {
                    console.log(`[MCP] Found ${sanitizedName} on ${serverName} via fallback scan`);
                    return await server.client.callTool({
                        name: tool.name,
                        arguments: args
                    });
                }
            } catch (e) {
                // Continue
            }
        }
        throw new Error(`Tool ${sanitizedName} not found`);
    }

    getConfig() {
        return this.config;
    }

    async setConfig(newConfig) {
        this.config = newConfig;
        this.saveConfig();

        // Reconcile state
        for (const [name, serverConfig] of Object.entries(this.config.mcpServers)) {
            const isRunning = !!this.servers[name];
            const shouldRun = !serverConfig.disabled;

            if (isRunning && !shouldRun) {
                await this.stopServer(name);
            } else if (!isRunning && shouldRun) {
                await this.connectServer(name, serverConfig);
            } else if (isRunning && shouldRun) {
                // Restart if config changed? For now assume valid. 
                // If deep compare differs we might restart.
            }
        }
    }

    async addServerJson(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            if (!parsed.mcpServers) throw new Error("Invalid JSON: missing mcpServers key");

            this.config.mcpServers = { ...this.config.mcpServers, ...parsed.mcpServers };
            this.saveConfig();

            // Try to start the new ones
            await this.initialize();

            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
}

module.exports = MCPManager;
