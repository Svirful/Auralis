const { safeStorage, app } = require('electron');
const path = require('path');
const fs = require('fs');

class AuthManager {
    constructor() {
        this.apiKeyPath = path.join(app.getPath("userData"), "api-key.json");
    }

    async saveApiKey(apiKey) {
        try {
            if (!apiKey || typeof apiKey !== 'string') {
                return false;
            }

            if (!safeStorage.isEncryptionAvailable()) {
                console.error("SafeStorage encryption is not available — refusing to store API key in plaintext.");
                return false;
            }

            const storedValue = safeStorage.encryptString(apiKey).toString('base64');

            fs.writeFileSync(this.apiKeyPath, JSON.stringify({
                key: storedValue,
                encrypted: true
            }, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error("Failed to save API key:", error);
            return false;
        }
    }

    async getApiKey() {
        try {
            if (!fs.existsSync(this.apiKeyPath)) {
                return null;
            }

            const data = JSON.parse(fs.readFileSync(this.apiKeyPath, 'utf8'));
            if (!data?.key) return null;

            if (data.encrypted && safeStorage.isEncryptionAvailable()) {
                return safeStorage.decryptString(Buffer.from(data.key, 'base64'));
            }
            return data.key;
        } catch (error) {
            console.error("Failed to get API key:", error);
            return null;
        }
    }
}

module.exports = AuthManager;
