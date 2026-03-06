const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class SkillsManager {
    constructor() {
        // Store skills in the user's app data directory so they are always writable
        // without requiring administrator / elevated privileges on Windows or macOS.
        this.appRoot = app.getPath('userData');
        this.skillsDirName = 'skills';
    }

    getSkillsPath() {
        return path.join(this.appRoot, this.skillsDirName);
    }

    ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            try {
                fs.mkdirSync(dirPath, { recursive: true });
            } catch (e) {
                console.error("Failed to create directory:", dirPath, e);
            }
        }
    }

    async listSkills() {
        const skills = [];
        const basePath = this.getSkillsPath();

        if (fs.existsSync(basePath)) {
            try {
                const items = fs.readdirSync(basePath, { withFileTypes: true });
                for (const item of items) {
                    if (item.isDirectory()) {
                        const skillFilePath = path.join(basePath, item.name, 'SKILL.md');
                        if (fs.existsSync(skillFilePath)) {
                            try {
                                const content = fs.readFileSync(skillFilePath, 'utf-8');
                                const nameMatch = content.match(/name:\s*(.+)/);
                                const descMatch = content.match(/description:\s*(.+)/);

                                const parts = content.split('---');
                                let instructions = '';
                                if (parts.length >= 3) {
                                    instructions = parts.slice(2).join('---').trim();
                                }

                                const name = nameMatch ? nameMatch[1].trim() : item.name;
                                const description = descMatch ? descMatch[1].trim() : '';

                                skills.push({
                                    id: item.name,
                                    name: name,
                                    description: description,
                                    instructions: instructions,
                                    path: skillFilePath
                                });
                            } catch (e) {
                                console.error("Error reading skill:", item.name, e);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error("Error scanning dir:", basePath, e);
            }
        }
        return skills;
    }

    async saveSkill(skillData) {
        const folderName = skillData.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const basePath = this.getSkillsPath();
        const skillDir = path.join(basePath, folderName);

        try {
            this.ensureDirectoryExists(skillDir);

            const content = `---
name: ${skillData.name}
description: ${skillData.description}
---

${skillData.instructions}
`;

            fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf-8');
            return { success: true };
        } catch (e) {
            console.error("Failed to save skill:", e);
            return { success: false, error: e.message };
        }
    }

    async deleteSkill(id) {
        // Sanitize ID to prevent path traversal
        const sanitizedId = id.replace(/[^a-z0-9-]/g, '');
        if (!sanitizedId || sanitizedId !== id) {
            return { success: false, error: 'Invalid skill ID' };
        }

        const basePath = this.getSkillsPath();
        const skillDir = path.join(basePath, sanitizedId);

        // Final safety check: ensure the resulting path is still within the skills directory
        if (!skillDir.startsWith(basePath)) {
            return { success: false, error: 'Access denied' };
        }

        if (fs.existsSync(skillDir)) {
            try {
                fs.rmSync(skillDir, { recursive: true, force: true });
                return { success: true };
            } catch (e) {
                return { success: false, error: e.message };
            }
        }
        return { success: false, error: 'Skill not found' };
    }
}

module.exports = SkillsManager;
