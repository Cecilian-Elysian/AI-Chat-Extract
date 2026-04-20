// ==UserScript==
// @name         AI Chat Extract
// @namespace    https://github.com/Cecilian-Elysian/AI-Chat-Extract
// @version      0.0.1
// @description   定时摘取AI聊天记录并导出
// @author       Cecilian-Elysian
// @match        *://chat.openai.com/*
// @match        *://claude.ai/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @connect      api.openai.com
// @connect      anthropic.com
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG_KEY = 'ai_chat_extract_config';
    const DATA_KEY = 'ai_chat_extract_data';

    const defaultConfig = {
        platforms: [
            { name: 'openai', enabled: false, apiKey: '' },
            { name: 'claude', enabled: false, apiKey: '' }
        ],
        intervalMinutes: 60,
        exportFormat: 'json',
        autoExport: true
    };

    function getConfig() {
        const stored = GM_getValue(CONFIG_KEY, null);
        if (stored) {
            return { ...defaultConfig, ...stored };
        }
        return defaultConfig;
    }

    function saveConfig(config) {
        GM_setValue(CONFIG_KEY, config);
    }

    function getData() {
        return GM_getValue(DATA_KEY, { sessions: [], lastExport: null });
    }

    function saveData(data) {
        GM_setValue(DATA_KEY, data);
    }

    function formatDate(date) {
        return date.toISOString();
    }

    function generateSessionId() {
        return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }

    class ChatSession {
        constructor(platform, title = '') {
            this.sessionId = generateSessionId();
            this.platform = platform;
            this.title = title || this.sessionId;
            this.messages = [];
            this.createdAt = formatDate(new Date());
        }

        addMessage(role, content) {
            this.messages.push({
                role,
                content,
                timestamp: formatDate(new Date())
            });
        }

        toJSON() {
            return {
                session_id: this.sessionId,
                platform: this.platform,
                title: this.title,
                messages: this.messages,
                created_at: this.createdAt
            };
        }
    }

    class OpenAIExtractor {
        constructor(apiKey) {
            this.platformName = 'openai';
            this.apiKey = apiKey;
        }

        async fetchSessions() {
            if (!this.apiKey) return [];
            try {
                const response = await this._request('/conversations');
                const conversations = response.items || [];
                return conversations.map(conv => {
                    const session = new ChatSession(this.platformName, conv.title || conv.id);
                    session.messages = conv.messages || [];
                    return session;
                });
            } catch (err) {
                console.error('OpenAI fetch error:', err);
                return [];
            }
        }

        async _request(endpoint, options = {}) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: options.method || 'GET',
                    url: `https://api.openai.com/v1${endpoint}`,
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    data: options.body ? JSON.stringify(options.body) : null,
                    onload: (res) => {
                        try {
                            resolve(JSON.parse(res.responseText));
                        } catch {
                            resolve(res.responseText);
                        }
                    },
                    onerror: reject
                });
            });
        }
    }

    class ClaudeExtractor {
        constructor(apiKey) {
            this.platformName = 'claude';
            this.apiKey = apiKey;
        }

        async fetchSessions() {
            if (!this.apiKey) return [];
            try {
                const response = await this._request('/organizations');
                const orgs = response.data || [];
                const sessions = [];
                for (const org of orgs) {
                    const conversations = await this._request(`/organizations/${org.id}/conversations`);
                    for (const conv of conversations.data || []) {
                        const session = new ChatSession(this.platformName, conv.title || conv.uuid);
                        session.conversationId = conv.uuid;
                        sessions.push(session);
                    }
                }
                return sessions;
            } catch (err) {
                console.error('Claude fetch error:', err);
                return [];
            }
        }

        async _request(endpoint, options = {}) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: options.method || 'GET',
                    url: `https://api.anthropic.com/v1${endpoint}`,
                    headers: {
                        'x-api-key': this.apiKey,
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01'
                    },
                    data: options.body ? JSON.stringify(options.body) : null,
                    onload: (res) => {
                        try {
                            resolve(JSON.parse(res.responseText));
                        } catch {
                            resolve(res.responseText);
                        }
                    },
                    onerror: reject
                });
            });
        }
    }

    class Exporter {
        static toJSON(sessions) {
            return JSON.stringify({
                exported_at: formatDate(new Date()),
                session_count: sessions.length,
                sessions: sessions.map(s => s.toJSON())
            }, null, 2);
        }

        static toCSV(sessions) {
            const rows = [['session_id', 'platform', 'title', 'role', 'content', 'timestamp']];
            for (const session of sessions) {
                for (const msg of session.messages) {
                    rows.push([
                        session.sessionId,
                        session.platform,
                        session.title,
                        msg.role,
                        `"${(msg.content || '').replace(/"/g, '""')}"`,
                        msg.timestamp
                    ]);
                }
            }
            return rows.map(r => r.join(',')).join('\n');
        }
    }

    class Scheduler {
        constructor(intervalMinutes, callback) {
            this.intervalMs = intervalMinutes * 60 * 1000;
            this.callback = callback;
            this.timerId = null;
        }

        start() {
            if (this.timerId) return;
            this.callback();
            this.timerId = setInterval(this.callback, this.intervalMs);
        }

        stop() {
            if (this.timerId) {
                clearInterval(this.timerId);
                this.timerId = null;
            }
        }

        runNow() {
            this.callback();
        }
    }

    class App {
        constructor() {
            this.config = getConfig();
            this.scheduler = null;
        }

        async runExtract() {
            const sessions = [];
            for (const platformConfig of this.config.platforms) {
                if (!platformConfig.enabled) continue;
                const extractor = this.createExtractor(platformConfig);
                if (extractor) {
                    const extracted = await extractor.fetchSessions();
                    sessions.push(...extracted);
                }
            }
            return sessions;
        }

        createExtractor(config) {
            if (config.name === 'openai') {
                return new OpenAIExtractor(config.apiKey);
            }
            if (config.name === 'claude') {
                return new ClaudeExtractor(config.apiKey);
            }
            return null;
        }

        exportSessions(sessions) {
            if (!sessions.length) {
                console.log('No sessions to export');
                return;
            }

            const data = getData();
            data.sessions = sessions;
            data.lastExport = formatDate(new Date());
            saveData(data);

            if (this.config.autoExport) {
                const content = this.config.exportFormat === 'csv'
                    ? Exporter.toCSV(sessions)
                    : Exporter.toJSON(sessions);

                const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                GM_download({
                    url,
                    name: `ai_chat_export_${Date.now()}.${this.config.exportFormat}`,
                    saveAs: true
                });
            }
        }

        async runOnce() {
            const sessions = await this.runExtract();
            this.exportSessions(sessions);
        }

        startScheduled() {
            this.scheduler = new Scheduler(this.config.intervalMinutes, () => this.runOnce());
            this.scheduler.start();
            this.showNotification('AI Chat Extract 已启动');
        }

        stopScheduled() {
            if (this.scheduler) {
                this.scheduler.stop();
                this.scheduler = null;
            }
        }

        showNotification(message) {
            GM_setValue('notification', { message, timestamp: Date.now() });
        }

        openConfigPanel() {
            const panel = document.createElement('div');
            panel.id = 'ai-chat-extract-panel';
            panel.innerHTML = `
                <div style="position:fixed;top:0;right:0;width:320px;height:100%;background:#fff;box-shadow:-2px 0 10px rgba(0,0,0,0.1);z-index:9999;padding:20px;overflow-y:auto;">
                    <h2 style="margin:0 0 20px 0;font-size:18px;">AI Chat Extract 配置</h2>
                    <div style="margin-bottom:15px;">
                        <label style="display:block;margin-bottom:5px;font-weight:bold;">OpenAI API Key</label>
                        <input type="password" id="openai-key" style="width:100%;padding:8px;" placeholder="sk-...">
                    </div>
                    <div style="margin-bottom:15px;">
                        <label style="display:block;margin-bottom:5px;font-weight:bold;">Claude API Key</label>
                        <input type="password" id="claude-key" style="width:100%;padding:8px;" placeholder="sk-ant-...">
                    </div>
                    <div style="margin-bottom:15px;">
                        <label style="display:block;margin-bottom:5px;font-weight:bold;">导出格式</label>
                        <select id="export-format" style="width:100%;padding:8px;">
                            <option value="json">JSON</option>
                            <option value="csv">CSV</option>
                        </select>
                    </div>
                    <div style="margin-bottom:15px;">
                        <label style="display:block;margin-bottom:5px;font-weight:bold;">定时间隔(分钟)</label>
                        <input type="number" id="interval" style="width:100%;padding:8px;" value="60" min="1">
                    </div>
                    <div style="margin-bottom:20px;">
                        <label><input type="checkbox" id="auto-export"> 自动导出</label>
                    </div>
                    <button id="save-config" style="width:100%;padding:10px;background:#4CAF50;color:#fff;border:none;cursor:pointer;margin-bottom:10px;">保存</button>
                    <button id="run-now" style="width:100%;padding:10px;background:#2196F3;color:#fff;border:none;cursor:pointer;margin-bottom:10px;">立即执行</button>
                    <button id="close-panel" style="width:100%;padding:10px;background:#999;color:#fff;border:none;cursor:pointer;">关闭</button>
                </div>
            `;
            document.body.appendChild(panel);

            const config = getConfig();
            document.getElementById('openai-key').value = config.platforms[0].apiKey || '';
            document.getElementById('claude-key').value = config.platforms[1].apiKey || '';
            document.getElementById('export-format').value = config.exportFormat || 'json';
            document.getElementById('interval').value = config.intervalMinutes || 60;
            document.getElementById('auto-export').checked = config.autoExport !== false;

            document.getElementById('save-config').onclick = () => {
                const newConfig = {
                    platforms: [
                        { name: 'openai', enabled: true, apiKey: document.getElementById('openai-key').value },
                        { name: 'claude', enabled: true, apiKey: document.getElementById('claude-key').value }
                    ],
                    exportFormat: document.getElementById('export-format').value,
                    intervalMinutes: parseInt(document.getElementById('interval').value) || 60,
                    autoExport: document.getElementById('auto-export').checked
                };
                saveConfig(newConfig);
                this.config = newConfig;
                this.showNotification('配置已保存');
            };

            document.getElementById('run-now').onclick = () => {
                this.runOnce();
                this.showNotification('导出完成');
            };

            document.getElementById('close-panel').onclick = () => {
                panel.remove();
            };
        }
    }

    const app = new App();

    GM_registerMenuCommand('AI Chat Extract - 配置面板', () => app.openConfigPanel());
    GM_registerMenuCommand('AI Chat Extract - 立即导出', () => app.runOnce());
    GM_registerMenuCommand('AI Chat Extract - 启动定时', () => app.startScheduled());
    GM_registerMenuCommand('AI Chat Extract - 停止定时', () => app.stopScheduled());

    console.log('AI Chat Extract 已加载');
})();