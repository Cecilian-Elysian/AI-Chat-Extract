// ==UserScript==
// @name         AI Chat Extract
// @namespace    https://github.com/Cecilian-Elysian/AI-Chat-Extract
// @version      1.0.0
// @description   定时摘取AI聊天记录并导出
// @author       Cecilian-Elysian
// @match        *://*.qianwen.com/*
// @match        *://*.quark.cn/*
// @match        *://qianwen.com/*
// @match        *://quark.cn/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @grant        GM_addStyle
// @connect      qianwen.com
// @connect      quark.cn
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG_KEY = 'aice_config';
    const COOKIE_KEY = 'aice_cookies';

    const defaultConfig = {
        intervalMinutes: 60,
        exportFormat: 'md',
        autoExport: true
    };

    function loadConfig() {
        const stored = GM_getValue(CONFIG_KEY, null);
        return stored ? { ...defaultConfig, ...stored } : defaultConfig;
    }

    function saveConfig(config) {
        GM_setValue(CONFIG_KEY, config);
    }

    function getCookies() {
        return GM_getValue(COOKIE_KEY, null);
    }

    function saveCookies(cookies) {
        GM_setValue(COOKIE_KEY, { cookies, time: Date.now() });
    }

    function getAllPageCookies() {
        const cookies = document.cookie.split(';');
        const obj = {};
        cookies.forEach(c => {
            const [k, v] = c.trim().split('=');
            if (k) obj[k] = v;
        });
        return obj;
    }

    function fetchCookies() {
        return new Promise((resolve) => {
            const cookies = getAllPageCookies();
            const token = cookies['aliyung残留'] || cookies['token'] || cookies['QToken'];
            if (token) {
                saveCookies(cookies);
                resolve(cookies);
                return;
            }
            const host = window.location.hostname;
            const url = host.includes('quark.cn')
                ? 'https://unite.quark.cn/page/chat'
                : 'https://qianwen.com/quarkchat';
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: () => {
                    const newCookies = getAllPageCookies();
                    saveCookies(newCookies);
                    resolve(newCookies);
                },
                onerror: () => resolve({})
            });
        });
    }

    function buildCookieHeader(cookies) {
        if (!cookies) return '';
        return Object.entries(cookies).map(([k, v]) => k + '=' + v).join('; ');
    }

    function httpRequest(url, cookies) {
        return new Promise((resolve, reject) => {
            const token = cookies['aliyung残留'] || cookies['token'] || cookies['QToken'];
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                headers: {
                    'Cookie': buildCookieHeader(cookies),
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                onload: (res) => {
                    try { resolve(JSON.parse(res.responseText)); }
                    catch { resolve(null); }
                },
                onerror: reject
            });
        });
    }

    function getBaseUrl() {
        return window.location.hostname.includes('quark.cn')
            ? 'https://unite.quark.cn'
            : 'https://qianwen.com';
    }

    async function fetchConversations() {
        let cookies = getCookies();
        if (!cookies || !cookies.cookies) {
            cookies = { cookies: await fetchCookies() };
        }

        const baseUrl = getBaseUrl();
        const listUrl = baseUrl.includes('quark.cn')
            ? baseUrl + '/pc/chat/conversation/list'
            : baseUrl + '/quarkchat/api/chat/list?type=conversation&page=1&pageSize=50';

        const data = await httpRequest(listUrl, cookies.cookies);
        if (!data || !data.data || !Array.isArray(data.data)) {
            console.log('[AICE] No conversations found');
            return [];
        }

        return data.data.map(item => ({
            id: item.id || item.conversation_id,
            title: item.title || item.name || '未命名',
            created_at: item.created_at || item.create_time
        }));
    }

    async function fetchMessages(conversationId) {
        let cookies = getCookies();
        if (!cookies || !cookies.cookies) return [];

        const baseUrl = getBaseUrl();
        const msgUrl = baseUrl.includes('quark.cn')
            ? baseUrl + '/pc/chat/message/list?conversation_id=' + conversationId
            : baseUrl + '/quarkchat/api/chat/messages?conversation_id=' + conversationId;

        const data = await httpRequest(msgUrl, cookies.cookies);
        if (!data || !data.messages) return [];
        return data.messages;
    }

    async function extractAll() {
        const conversations = await fetchConversations();
        console.log('[AICE] Found', conversations.length, 'conversations');

        const sessions = [];
        for (const conv of conversations) {
            const messages = await fetchMessages(conv.id);
            sessions.push({
                sessionId: conv.id,
                platform: 'qianwen',
                title: conv.title,
                created_at: conv.created_at,
                messages: messages.map(m => ({
                    role: m.role === 'user' ? 'user' : 'assistant',
                    content: m.content || m.text || '',
                    timestamp: m.created_at || ''
                }))
            });
        }
        return sessions;
    }

    function toMarkdown(sessions) {
        let md = '';
        const date = new Date().toLocaleString('zh-CN');
        for (const s of sessions) {
            md += '# ' + s.title + '\n\n';
            md += '> Platform: ' + s.platform + ' | Date: ' + (s.created_at || date) + '\n\n';
            for (const m of s.messages) {
                md += '## ' + (m.role === 'user' ? '用户' : '助手') + '\n\n' + m.content + '\n\n';
            }
            md += '---\n\n';
        }
        md += '\n> Export: ' + date + ' | Total: ' + sessions.length + ' conversations\n';
        return md;
    }

    function toJSON(sessions) {
        return JSON.stringify({
            exported_at: new Date().toISOString(),
            session_count: sessions.length,
            sessions: sessions
        }, null, 2);
    }

    function toCSV(sessions) {
        const rows = [['session_id', 'platform', 'title', 'role', 'content', 'timestamp']];
        for (const s of sessions) {
            for (const m of s.messages) {
                rows.push([
                    s.sessionId, s.platform, s.title, m.role,
                    '"' + (m.content || '').replace(/"/g, '""') + '"',
                    m.timestamp || ''
                ]);
            }
        }
        return rows.map(r => r.join(',')).join('\n');
    }

    function download(content, filename, mimeType) {
        const blob = new Blob(['\uFEFF' + content], { type: mimeType });
        const url = URL.createObjectURL(blob);

        if (typeof GM_download !== 'undefined') {
            GM_download({
                url: url,
                name: filename,
                saveAs: true,
                onload: () => {
                    URL.revokeObjectURL(url);
                    console.log('[AICE] Download success');
                },
                onerror: () => {
                    console.log('[AICE] Download failed, trying native');
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);
                }
            });
        } else {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    function exportSessions(sessions) {
        if (!sessions.length) {
            console.log('[AICE] No sessions to export');
            document.getElementById('aice-status').textContent = '无对话可导出';
            return;
        }

        const config = loadConfig();
        const timestamp = Date.now();
        let content, filename, mimeType;

        if (config.exportFormat === 'json') {
            content = toJSON(sessions);
            filename = 'aice_' + timestamp + '.json';
            mimeType = 'application/json';
        } else if (config.exportFormat === 'csv') {
            content = toCSV(sessions);
            filename = 'aice_' + timestamp + '.csv';
            mimeType = 'text/csv';
        } else {
            content = toMarkdown(sessions);
            filename = 'aice_' + timestamp + '.md';
            mimeType = 'text/plain';
        }

        console.log('[AICE] Content length:', content.length);
        console.log('[AICE] Filename:', filename);
        console.log('[AICE] GM_download available:', typeof GM_download !== 'undefined');

        download(content, filename, mimeType);
        document.getElementById('aice-status').textContent = '已触发下载';
    }

    async function runOnce() {
        console.log('[AICE] Starting extraction...');
        const sessions = await extractAll();
        exportSessions(sessions);
        GM_setValue('aice_last_run', Date.now());
    }

    function createUI() {
        GM_addStyle(`
            .aice-panel {
                position: fixed; top: 0; right: 0; width: 280px; height: 100%;
                background: #1a1a2e; color: #eee; z-index: 99999;
                padding: 20px; font-family: -apple-system, sans-serif;
                box-shadow: -4px 0 20px rgba(0,0,0,0.3);
            }
            .aice-panel h2 { margin: 0 0 20px; color: #fff; font-size: 16px; }
            .aice-panel .row { margin-bottom: 15px; }
            .aice-panel label { display: block; margin-bottom: 5px; font-size: 12px; color: #aaa; }
            .aice-panel select, .aice-panel input { width: 100%; padding: 8px; border: 1px solid #333; border-radius: 4px; background: #16213e; color: #fff; font-size: 13px; box-sizing: border-box; }
            .aice-panel button {
                width: 100%; padding: 10px; border: none; border-radius: 6px;
                cursor: pointer; font-size: 13px; margin-bottom: 8px;
            }
            .aice-panel .btn-primary { background: #667eea; color: #fff; }
            .aice-panel .btn-secondary { background: #3b82f6; color: #fff; }
            .aice-panel .btn-cookie { background: #8b5cf6; color: #fff; }
            .aice-panel .info { font-size: 11px; color: #888; margin-top: 4px; }
            .aice-panel .status { padding: 8px; background: #16213e; border-radius: 4px; font-size: 12px; color: #10b981; text-align: center; margin-top: 15px; }
        `);

        const panel = document.createElement('div');
        panel.className = 'aice-panel';
        panel.innerHTML = `
            <h2>📥 AI Chat Extract</h2>
            <div class="row">
                <label>导出格式</label>
                <select id="aice-format">
                    <option value="md">Markdown (.md)</option>
                    <option value="json">JSON (.json)</option>
                    <option value="csv">CSV (.csv)</option>
                </select>
            </div>
            <div class="row">
                <label>定时间隔（分钟）</label>
                <input type="number" id="aice-interval" value="60" min="1">
            </div>
            <div class="row">
                <button class="btn-cookie" id="aice-get-cookie">🍪 获取Cookie</button>
                <div class="info" id="aice-cookie-info">未获取</div>
            </div>
            <button class="btn-primary" id="aice-run">▶ 立即导出</button>
            <button class="btn-secondary" id="aice-auto">⏰ 启动定时</button>
            <div class="status" id="aice-status">就绪</div>
        `;
        document.body.appendChild(panel);

        const config = loadConfig();
        const cookies = getCookies();
        document.getElementById('aice-format').value = config.exportFormat || 'md';
        document.getElementById('aice-interval').value = config.intervalMinutes || 60;
        document.getElementById('aice-cookie-info').textContent = cookies ? '已获取 (' + Object.keys(cookies.cookies || {}).length + ')' : '未获取';

        document.getElementById('aice-get-cookie').onclick = async () => {
            document.getElementById('aice-cookie-info').textContent = '获取中...';
            const newCookies = await fetchCookies();
            document.getElementById('aice-cookie-info').textContent = newCookies && Object.keys(newCookies).length ? '已获取 (' + Object.keys(newCookies).length + ')' : '获取失败';
        };

        document.getElementById('aice-run').onclick = async () => {
            const format = document.getElementById('aice-format').value;
            const interval = parseInt(document.getElementById('aice-interval').value) || 60;
            saveConfig({ ...loadConfig(), exportFormat: format, intervalMinutes: interval });
            document.getElementById('aice-status').textContent = '导出中...';
            testDownload();
        };

        function testDownload() {
            const testContent = 'Hello, this is a test download at ' + new Date().toLocaleString();
            const blob = new Blob([testContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            console.log('[AICE] Testing download with GM_download:', typeof GM_download !== 'undefined');
            GM_download({ url: url, name: 'test_' + Date.now() + '.txt', saveAs: true });
            setTimeout(() => URL.revokeObjectURL(url), 3000);
        }

        let timerId = null;
        document.getElementById('aice-auto').onclick = () => {
            if (timerId) {
                clearInterval(timerId);
                timerId = null;
                document.getElementById('aice-auto').textContent = '⏰ 启动定时';
                document.getElementById('aice-status').textContent = '定时已停止';
                return;
            }
            const interval = parseInt(document.getElementById('aice-interval').value) || 60;
            document.getElementById('aice-auto').textContent = '⏹ 停止定时';
            document.getElementById('aice-status').textContent = '定时中 (' + interval + 'min)';
            runOnce();
            timerId = setInterval(runOnce, interval * 60 * 1000);
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createUI);
    } else {
        createUI();
    }

    console.log('[AICE] AI Chat Extract v1.0.0 loaded');
})();