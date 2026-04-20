// ==UserScript==
// @name         AI Chat Extract
// @namespace    https://github.com/Cecilian-Elysian/AI-Chat-Extract
// @version      0.0.4
// @description   定时摘取AI聊天记录并导出 (支持千问/OpenAI/Claude)
// @author       Cecilian-Elysian
// @match        *://*.qianwen.com/*
// @match        *://*.quark.cn/*
// @match        *://qianwen.com/*
// @match        *://quark.cn/*
// @match        *://chat.openai.com/*
// @match        *://claude.ai/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @grant        GM_addStyle
// @connect      api.openai.com
// @connect      anthropic.com
// @connect      qianwen.com
// @connect      quark.cn
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG_KEY = 'ai_chat_extract_config';
    const DATA_KEY = 'ai_chat_extract_data';
    const COOKIE_KEY = 'ai_chat_extract_cookies';
    const LAST_RUN_KEY = 'ai_chat_extract_last_run';

    const defaultConfig = {
        platforms: {
            openai: { enabled: false, apiKey: '' },
            claude: { enabled: false, apiKey: '' },
            qianwen: { enabled: true }
        },
        intervalMinutes: 60,
        exportFormat: 'md',
        autoExport: true,
        autoRunOnLoad: true
    };

    class CookieManager {
        static getCookieDomain() {
            return window.location.hostname.includes('quark.cn') ? 'quark.cn' : 'qianwen.com';
        }

        static getAllCookies() {
            const cookies = document.cookie.split(';');
            const cookieObj = {};
            cookies.forEach(c => {
                const [k, v] = c.trim().split('=');
                if (k) cookieObj[k] = v;
            });
            return cookieObj;
        }

        static getAuthToken() {
            const cookies = this.getAllCookies();
            return cookies['aliyung残留'] || cookies['token'] || cookies['csrf'] || cookies['QToken'] || '';
        }

        static async fetchCookie() {
            return new Promise((resolve) => {
                const cookies = this.getAllCookies();
                const token = cookies['aliyung残留'] || cookies['token'] || cookies['QToken'];
                if (token) {
                    this.saveCookies(cookies);
                    resolve(cookies);
                    return;
                }
                const currentHost = window.location.hostname;
                const targetUrl = currentHost.includes('quark.cn')
                    ? `https://unite.quark.cn/page/chat`
                    : 'https://qianwen.com/quarkchat';
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: targetUrl,
                    onload: (res) => {
                        const newCookies = this.getAllCookies();
                        this.saveCookies(newCookies);
                        resolve(newCookies);
                    },
                    onerror: () => resolve({})
                });
            });
        }

        static saveCookies(cookies) {
            const data = {
                cookies,
                timestamp: Date.now()
            };
            GM_setValue(COOKIE_KEY, data);
        }

        static getSavedCookies() {
            const data = GM_getValue(COOKIE_KEY, null);
            if (!data) return null;
            const age = Date.now() - data.timestamp;
            if (age > 7 * 24 * 60 * 60 * 1000) return null;
            return data.cookies;
        }

        static buildCookieHeader(cookies) {
            if (!cookies) return '';
            return Object.entries(cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join('; ');
        }
    }

    class ApiInterceptor {
        constructor() {
            this.chatMessages = new Map();
            this.originalFetch = window.fetch;
            this.setup();
        }

        setup() {
            const self = this;
            window.fetch = async function(...args) {
                const [url, options] = args;
                const response = await self.originalFetch.apply(window, args);
                if (typeof url === 'string' && (url.includes('/api/chat') || url.includes('/quarkchat'))) {
                    try {
                        const clonedResp = response.clone();
                        const data = await clonedResp.json();
                        self.captureChatData(url, data);
                    } catch (e) {}
                }
                return response;
            };
        }

        captureChatData(url, data) {
            if (url.includes('/chat/list') || url.includes('/conversation/list')) {
                if (data.data && Array.isArray(data.data)) {
                    data.data.forEach(item => {
                        if (item.id) {
                            this.chatMessages.set(item.id, {
                                id: item.id,
                                title: item.title || item.name || '未命名对话',
                                messages: [],
                                timestamp: item.created_at || Date.now()
                            });
                        }
                    });
                }
            }
            if (url.includes('/chat/messages') || url.includes('/message/list')) {
                if (data.messages) {
                    const sessionId = data.conversation_id || data.chat_id;
                    if (sessionId && this.chatMessages.has(sessionId)) {
                        this.chatMessages.get(sessionId).messages = data.messages;
                    }
                }
            }
        }

        getMessages() {
            return Array.from(this.chatMessages.values());
        }

        clear() {
            this.chatMessages.clear();
        }
    }

    class QianwenExtractor {
        constructor(config) {
            this.platformName = 'qianwen';
            this.config = config;
            this.interceptor = new ApiInterceptor();
        }

        getBaseUrl() {
            return window.location.hostname.includes('quark.cn')
                ? 'https://unite.quark.cn'
                : 'https://qianwen.com';
        }

        async fetchConversations() {
            const cookies = CookieManager.getSavedCookies() || await CookieManager.fetchCookie();
            const cookieHeader = CookieManager.buildCookieHeader(cookies);
            const token = cookies['aliyung残留'] || cookies['token'] || cookies['QToken'];

            if (!token) {
                console.error('[Qianwen] No auth token found');
                return [];
            }

            const baseUrl = this.getBaseUrl();
            const listUrl = baseUrl.includes('quark.cn')
                ? `${baseUrl}/pc/chat/conversation/list`
                : `${baseUrl}/quarkchat/api/chat/list?type=conversation&page=1&pageSize=50`;

            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: listUrl,
                    headers: {
                        'Cookie': cookieHeader,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    onload: (res) => {
                        try {
                            const data = JSON.parse(res.responseText);
                            const conversations = [];

                            if (data.data && Array.isArray(data.data)) {
                                data.data.forEach(conv => {
                                    conversations.push({
                                        id: conv.id || conv.conversation_id,
                                        title: conv.title || conv.name || '未命名对话',
                                        created_at: conv.created_at || conv.create_time,
                                        messages: []
                                    });
                                });
                            }
                            resolve(conversations);
                        } catch (e) {
                            console.error('[Qianwen] Parse error:', e);
                            resolve([]);
                        }
                    },
                    onerror: () => resolve([])
                });
            });
        }

        async fetchMessages(conversationId) {
            const cookies = CookieManager.getSavedCookies();
            if (!cookies) return [];

            const cookieHeader = CookieManager.buildCookieHeader(cookies);
            const token = cookies['aliyung残留'] || cookies['token'] || cookies['QToken'];

            const baseUrl = this.getBaseUrl();
            const msgUrl = baseUrl.includes('quark.cn')
                ? `${baseUrl}/pc/chat/message/list?conversation_id=${conversationId}`
                : `${baseUrl}/quarkchat/api/chat/messages?conversation_id=${conversationId}`;

            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: msgUrl,
                    headers: {
                        'Cookie': cookieHeader,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    onload: (res) => {
                        try {
                            const data = JSON.parse(res.responseText);
                            resolve(data.messages || []);
                        } catch {
                            resolve([]);
                        }
                    },
                    onerror: () => resolve([])
                });
            });
        }

        async run() {
            const conversations = await this.fetchConversations();
            for (const conv of conversations) {
                conv.messages = await this.fetchMessages(conv.id);
            }
            return conversations.map(c => ({
                sessionId: c.id,
                platform: 'qianwen',
                title: c.title,
                messages: c.messages.map(m => ({
                    role: m.role === 'user' ? 'user' : 'assistant',
                    content: m.content || m.text || '',
                    timestamp: m.created_at || m.timestamp || ''
                })),
                created_at: c.created_at
            }));
        }
    }

    class OpenAIExtractor {
        constructor(apiKey) {
            this.platformName = 'openai';
            this.apiKey = apiKey;
        }

        async run() {
            if (!this.apiKey) return [];
            try {
                const response = await this._request('/conversations');
                return (response.items || []).map(conv => ({
                    sessionId: conv.id,
                    platform: 'openai',
                    title: conv.title || conv.id,
                    messages: (conv.messages || []).map(m => ({
                        role: m.role || 'user',
                        content: m.content || m.text || '',
                        timestamp: m.created_at || ''
                    })),
                    created_at: conv.created_at || ''
                }));
            } catch (err) {
                console.error('OpenAI error:', err);
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
                        try { resolve(JSON.parse(res.responseText)); }
                        catch { resolve(res.responseText); }
                    },
                    onerror: reject
                });
            });
        }
    }

    class Exporter {
        static toMarkdown(sessions) {
            let md = '';
            const date = new Date().toLocaleString('zh-CN');

            for (const session of sessions) {
                md += `# ${session.title || '未命名对话'}\n\n`;
                md += `> Platform: ${session.platform} | Date: ${session.created_at || date}\n\n`;

                for (const msg of session.messages) {
                    const roleLabel = msg.role === 'user' ? '用户' : '助手';
                    md += `## ${roleLabel}\n\n${msg.content}\n\n`;
                }
                md += '---\n\n';
            }

            md += `\n> Export time: ${date} | Total: ${sessions.length} conversations\n`;
            return md;
        }

        static toJSON(sessions) {
            return JSON.stringify({
                exported_at: new Date().toISOString(),
                session_count: sessions.length,
                sessions
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
                        msg.timestamp || ''
                    ]);
                }
            }
            return rows.map(r => r.join(',')).join('\n');
        }
    }

    class Scheduler {
        constructor(intervalMinutes) {
            this.intervalMs = intervalMinutes * 60 * 1000;
            this.callback = null;
            this.timerId = null;
        }

        setCallback(cb) {
            this.callback = cb;
        }

        start() {
            if (this.timerId) return;
            if (this.callback) this.callback();
            this.timerId = setInterval(this.callback, this.intervalMs);
        }

        stop() {
            if (this.timerId) {
                clearInterval(this.timerId);
                this.timerId = null;
            }
        }

        shouldRun() {
            const lastRun = GM_getValue(LAST_RUN_KEY, 0);
            return Date.now() - lastRun >= this.intervalMs;
        }

        markRun() {
            GM_setValue(LAST_RUN_KEY, Date.now());
        }
    }

    class App {
        constructor() {
            this.config = this.loadConfig();
            this.scheduler = new Scheduler(this.config.intervalMinutes);
            this.scheduler.setCallback(() => this.runOnce());
        }

        loadConfig() {
            const stored = GM_getValue(CONFIG_KEY, null);
            return stored ? { ...defaultConfig, ...stored } : defaultConfig;
        }

        saveConfig(config) {
            this.config = config;
            GM_setValue(CONFIG_KEY, config);
            this.scheduler = new Scheduler(config.intervalMinutes);
            this.scheduler.setCallback(() => this.runOnce());
        }

        async runExtract() {
            const sessions = [];

            if (this.config.platforms.qianwen?.enabled) {
                const extractor = new QianwenExtractor(this.config);
                const qianwenSessions = await extractor.run();
                sessions.push(...qianwenSessions);
            }

            if (this.config.platforms.openai?.enabled && this.config.platforms.openai.apiKey) {
                const extractor = new OpenAIExtractor(this.config.platforms.openai.apiKey);
                const openaiSessions = await extractor.run();
                sessions.push(...openaiSessions);
            }

            return sessions;
        }

        exportSessions(sessions) {
            if (!sessions.length) {
                console.log('No sessions to export');
                return 0;
            }

            const data = { sessions, lastExport: Date.now() };
            GM_setValue(DATA_KEY, data);

            if (this.config.autoExport) {
                let content, filename, mimeType;

                if (this.config.exportFormat === 'md') {
                    content = Exporter.toMarkdown(sessions);
                    filename = `ai_chat_export_${Date.now()}.md`;
                    mimeType = 'text/markdown;charset=utf-8';
                } else if (this.config.exportFormat === 'csv') {
                    content = Exporter.toCSV(sessions);
                    filename = `ai_chat_export_${Date.now()}.csv`;
                    mimeType = 'text/csv;charset=utf-8';
                } else {
                    content = Exporter.toJSON(sessions);
                    filename = `ai_chat_export_${Date.now()}.json`;
                    mimeType = 'application/json;charset=utf-8';
                }

                const blob = new Blob([content], { type: mimeType });
                const url = URL.createObjectURL(blob);
                GM_download({ url, name: filename, saveAs: true });
            }

            return sessions.length;
        }

        async runOnce() {
            const sessions = await this.runExtract();
            const count = this.exportSessions(sessions);
            this.scheduler.markRun();
            console.log(`[AI Chat Extract] Exported ${count} sessions`);
            return count;
        }

        startScheduled() {
            this.scheduler.start();
            this.showNotification('定时任务已启动');
        }

        stopScheduled() {
            this.scheduler.stop();
            this.showNotification('定时任务已停止');
        }

        showNotification(msg) {
            GM_setValue('notification', { message: msg, timestamp: Date.now() });
        }

        openConfigPanel() {
            const existing = document.getElementById('ai-chat-extract-panel');
            if (existing) { existing.remove(); return; }

            const panel = document.createElement('div');
            panel.id = 'ai-chat-extract-panel';
            panel.innerHTML = `
                <style>
                    #ai-chat-extract-panel {
                        position: fixed; top: 0; right: 0; width: 360px; height: 100%;
                        background: #1a1a2e; color: #eee; z-index: 99999;
                        padding: 20px; overflow-y: auto; box-shadow: -4px 0 20px rgba(0,0,0,0.3);
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    }
                    #ai-chat-extract-panel h2 { margin: 0 0 20px 0; font-size: 18px; color: #fff; }
                    #ai-chat-extract-panel .form-group { margin-bottom: 15px; }
                    #ai-chat-extract-panel label { display: block; margin-bottom: 6px; font-size: 13px; color: #aaa; }
                    #ai-chat-extract-panel input[type="text"], #ai-chat-extract-panel input[type="password"],
                    #ai-chat-extract-panel select { width: 100%; padding: 10px; border: 1px solid #333; border-radius: 6px;
                        background: #16213e; color: #fff; font-size: 14px; box-sizing: border-box; }
                    #ai-chat-extract-panel input:focus { outline: none; border-color: #0f3460; }
                    #ai-chat-extract-panel .checkbox-group { display: flex; align-items: center; gap: 8px; }
                    #ai-chat-extract-panel .checkbox-group input { width: auto; }
                    #ai-chat-extract-panel button {
                        width: 100%; padding: 12px; border: none; border-radius: 6px; cursor: pointer;
                        font-size: 14px; margin-bottom: 10px; font-weight: 500; transition: opacity 0.2s;
                    }
                    #ai-chat-extract-panel button:hover { opacity: 0.85; }
                    #ai-chat-extract-panel .btn-save { background: #00d26a; color: #000; }
                    #ai-chat-extract-panel .btn-run { background: #3b82f6; color: #fff; }
                    #ai-chat-extract-panel .btn-close { background: #555; color: #fff; }
                    #ai-chat-extract-panel .btn-fetch-cookie { background: #8b5cf6; color: #fff; font-size: 12px; padding: 8px; }
                    #ai-chat-extract-panel .cookie-status { font-size: 11px; color: #888; margin-top: 4px; }
                    #ai-chat-extract-panel .platform-section { background: #16213e; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
                    #ai-chat-extract-panel .platform-title { font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #fff; }
                </style>
                <h2>AI Chat Extract 配置</h2>

                <div class="platform-section">
                    <div class="platform-title">通义千问</div>
                    <div class="form-group">
                        <div class="checkbox-group">
                            <input type="checkbox" id="qianwen-enabled" checked>
                            <label for="qianwen-enabled" style="margin:0">启用千问提取</label>
                        </div>
                    </div>
                    <div class="form-group">
                        <button class="btn-fetch-cookie" id="fetch-cookie-btn">自动获取 Cookie</button>
                        <div class="cookie-status" id="cookie-status">未获取</div>
                    </div>
                </div>

                <div class="platform-section">
                    <div class="platform-title">OpenAI</div>
                    <div class="form-group">
                        <div class="checkbox-group">
                            <input type="checkbox" id="openai-enabled">
                            <label for="openai-enabled" style="margin:0">启用 OpenAI</label>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>API Key</label>
                        <input type="password" id="openai-key" placeholder="sk-...">
                    </div>
                </div>

                <div class="form-group">
                    <label>导出格式</label>
                    <select id="export-format">
                        <option value="md">Markdown (.md)</option>
                        <option value="json">JSON (.json)</option>
                        <option value="csv">CSV (.csv)</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>定时间隔（分钟）</label>
                    <input type="number" id="interval" value="60" min="1">
                </div>

                <div class="form-group">
                    <div class="checkbox-group">
                        <input type="checkbox" id="auto-export" checked>
                        <label for="auto-export" style="margin:0">自动下载导出文件</label>
                    </div>
                </div>

                <div class="form-group">
                    <div class="checkbox-group">
                        <input type="checkbox" id="auto-run" checked>
                        <label for="auto-run" style="margin:0">页面加载时自动执行</label>
                    </div>
                </div>

                <button class="btn-save" id="save-config">保存配置</button>
                <button class="btn-run" id="run-now">立即导出</button>
                <button class="btn-close" id="close-panel">关闭</button>
            `;

            document.body.appendChild(panel);

            const config = this.loadConfig();
            document.getElementById('qianwen-enabled').checked = config.platforms.qianwen?.enabled !== false;
            document.getElementById('openai-enabled').checked = config.platforms.openai?.enabled || false;
            document.getElementById('openai-key').value = config.platforms.openai?.apiKey || '';
            document.getElementById('export-format').value = config.exportFormat || 'md';
            document.getElementById('interval').value = config.intervalMinutes || 60;
            document.getElementById('auto-export').checked = config.autoExport !== false;
            document.getElementById('auto-run').checked = config.autoRunOnLoad !== false;

            const savedCookies = CookieManager.getSavedCookies();
            document.getElementById('cookie-status').textContent = savedCookies
                ? `已获取 (${Object.keys(savedCookies).length} cookies)`
                : '未获取';

            document.getElementById('fetch-cookie-btn').onclick = async () => {
                document.getElementById('cookie-status').textContent = '获取中...';
                await CookieManager.fetchCookie();
                const cookies = CookieManager.getSavedCookies();
                document.getElementById('cookie-status').textContent = cookies
                    ? `已获取 (${Object.keys(cookies).length} cookies)`
                    : '获取失败';
            };

            document.getElementById('save-config').onclick = () => {
                const newConfig = {
                    platforms: {
                        qianwen: { enabled: document.getElementById('qianwen-enabled').checked },
                        openai: {
                            enabled: document.getElementById('openai-enabled').checked,
                            apiKey: document.getElementById('openai-key').value
                        }
                    },
                    exportFormat: document.getElementById('export-format').value,
                    intervalMinutes: parseInt(document.getElementById('interval').value) || 60,
                    autoExport: document.getElementById('auto-export').checked,
                    autoRunOnLoad: document.getElementById('auto-run').checked
                };
                this.saveConfig(newConfig);
                alert('配置已保存');
            };

            document.getElementById('run-now').onclick = () => {
                this.runOnce();
            };

            document.getElementById('close-panel').onclick = () => {
                panel.remove();
            };
        }

        createFloatingWidget() {
            const existing = document.getElementById('ai-chat-float-widget');
            if (existing) { existing.remove(); return; }

            const widget = document.createElement('div');
            widget.id = 'ai-chat-float-widget';

            let isExpanded = false;
            let posX = 20, posY = 100;
            let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;

            const collapsedHTML = `
                <style>
                    #ai-chat-float-widget {
                        position: fixed; z-index: 99998;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        font-size: 12px;
                    }
                    #ai-chat-float-toggle {
                        width: 40px; height: 40px; border-radius: 50%;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: #fff; border: none; cursor: pointer;
                        font-size: 18px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                        display: flex; align-items: center; justify-content: center;
                    }
                    #ai-chat-float-toggle:hover { transform: scale(1.05); }
                    #ai-chat-float-panel {
                        display: none; position: absolute; top: 50px; left: 0;
                        background: #1a1a2e; border-radius: 12px; padding: 15px;
                        box-shadow: 0 8px 30px rgba(0,0,0,0.3); min-width: 200px;
                        color: #eee;
                    }
                    #ai-chat-float-panel.show { display: block; }
                    #ai-chat-float-panel .float-row { margin-bottom: 12px; }
                    #ai-chat-float-panel label { display: block; margin-bottom: 4px; font-size: 11px; color: #aaa; }
                    #ai-chat-float-panel select, #ai-chat-float-panel input[type="number"] {
                        width: 100%; padding: 6px; border: 1px solid #333; border-radius: 4px;
                        background: #16213e; color: #fff; font-size: 12px;
                    }
                    #ai-chat-float-panel .float-btn {
                        width: 100%; padding: 8px; border: none; border-radius: 6px;
                        cursor: pointer; font-size: 12px; margin-bottom: 6px;
                    }
                    #ai-chat-float-panel .btn-run { background: #3b82f6; color: #fff; }
                    #ai-chat-float-panel .btn-timer-on { background: #10b981; color: #fff; }
                    #ai-chat-float-panel .btn-timer-off { background: #ef4444; color: #fff; }
                    #ai-chat-float-panel .btn-cookie { background: #8b5cf6; color: #fff; }
                    #ai-chat-float-panel .cookie-info { font-size: 10px; color: #666; margin-top: 4px; }
                    #ai-chat-float-panel .status-bar {
                        padding: 6px; background: #16213e; border-radius: 4px;
                        font-size: 10px; color: #888; text-align: center;
                    }
                </style>
                <button id="ai-chat-float-toggle">📥</button>
                <div id="ai-chat-float-panel">
                    <div class="float-row">
                        <label>间隔 (分钟)</label>
                        <input type="number" id="float-interval" value="60" min="1">
                    </div>
                    <div class="float-row">
                        <label>导出格式</label>
                        <select id="float-format">
                            <option value="md">Markdown</option>
                            <option value="json">JSON</option>
                            <option value="csv">CSV</option>
                        </select>
                    </div>
                    <div class="float-row">
                        <button class="float-btn btn-run" id="float-run">▶ 立即导出</button>
                        <button class="float-btn btn-timer-on" id="float-timer-on">⏰ 启动定时</button>
                        <button class="float-btn btn-timer-off" id="float-timer-off" style="display:none">⏹ 停止定时</button>
                        <button class="float-btn btn-cookie" id="float-cookie">🍪 获取Cookie</button>
                    </div>
                    <div class="cookie-info" id="float-cookie-info">未获取</div>
                    <div class="status-bar" id="float-status">就绪</div>
                </div>
            `;

            widget.innerHTML = collapsedHTML;
            document.body.appendChild(widget);

            widget.style.left = posX + 'px';
            widget.style.top = posY + 'px';

            const config = this.loadConfig();
            const savedCookies = CookieManager.getSavedCookies();

            document.getElementById('float-interval').value = config.intervalMinutes || 60;
            document.getElementById('float-format').value = config.exportFormat || 'md';
            document.getElementById('float-cookie-info').textContent = savedCookies
                ? `已登录 (${Object.keys(savedCookies).length} cookies)`
                : '未登录';

            document.getElementById('ai-chat-float-toggle').onclick = () => {
                const panel = document.getElementById('ai-chat-float-panel');
                panel.classList.toggle('show');
            };

            document.getElementById('float-run').onclick = () => {
                const interval = parseInt(document.getElementById('float-interval').value) || 60;
                const format = document.getElementById('float-format').value;
                this.saveConfig({ ...this.loadConfig(), intervalMinutes: interval, exportFormat: format });
                this.runOnce();
                document.getElementById('float-status').textContent = '导出中...';
                setTimeout(() => { document.getElementById('float-status').textContent = '导出完成'; }, 2000);
            };

            document.getElementById('float-timer-on').onclick = () => {
                const interval = parseInt(document.getElementById('float-interval').value) || 60;
                const format = document.getElementById('float-format').value;
                this.saveConfig({ ...this.loadConfig(), intervalMinutes: interval, exportFormat: format });
                this.startScheduled();
                document.getElementById('float-timer-on').style.display = 'none';
                document.getElementById('float-timer-off').style.display = 'block';
                document.getElementById('float-status').textContent = `定时中 (${interval}min)`;
            };

            document.getElementById('float-timer-off').onclick = () => {
                this.stopScheduled();
                document.getElementById('float-timer-on').style.display = 'block';
                document.getElementById('float-timer-off').style.display = 'none';
                document.getElementById('float-status').textContent = '已停止';
            };

            document.getElementById('float-cookie').onclick = async () => {
                document.getElementById('float-cookie-info').textContent = '获取中...';
                await CookieManager.fetchCookie();
                const cookies = CookieManager.getSavedCookies();
                document.getElementById('float-cookie-info').textContent = cookies
                    ? `已登录 (${Object.keys(cookies).length} cookies)`
                    : '获取失败';
            };

            const toggleBtn = document.getElementById('ai-chat-float-toggle');
            toggleBtn.onmousedown = (e) => {
                isDragging = true;
                dragOffsetX = e.clientX - posX;
                dragOffsetY = e.clientY - posY;
            };
            document.onmousemove = (e) => {
                if (!isDragging) return;
                posX = e.clientX - dragOffsetX;
                posY = e.clientY - dragOffsetY;
                widget.style.left = posX + 'px';
                widget.style.top = posY + 'px';
            };
            document.onmouseup = () => { isDragging = false; };
        }
    }

    const app = new App();

    GM_registerMenuCommand('AI Chat Extract - 配置面板', () => app.openConfigPanel());
    GM_registerMenuCommand('AI Chat Extract - 悬浮窗', () => app.createFloatingWidget());
    GM_registerMenuCommand('AI Chat Extract - 立即导出', () => app.runOnce());
    GM_registerMenuCommand('AI Chat Extract - 启动定时', () => app.startScheduled());
    GM_registerMenuCommand('AI Chat Extract - 停止定时', () => app.stopScheduled());

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            app.createFloatingWidget();
        });
    } else {
        app.createFloatingWidget();
    }

    if (app.config.autoRunOnLoad && app.scheduler.shouldRun()) {
        setTimeout(() => app.runOnce(), 3000);
    }

    console.log('AI Chat Extract 已加载 (v0.0.3) - 支持夸克浏览器千问');
})();