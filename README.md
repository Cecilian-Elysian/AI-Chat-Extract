# AI Chat Extract

定时摘取 AI 聊天记录并导出的脚本，运行于 ScriptCat 浏览器扩展。

## 功能

- 支持 OpenAI ChatGPT 对话导出
- 支持 Claude AI 对话导出
- 多种导出格式 (JSON/CSV)
- 可配置定时任务
- 本地数据存储

## 使用方法

1. 安装 [ScriptCat](https://github.com/scriptcat-org/scriptcat) 浏览器扩展
2. 将 `ai-chat-extract.user.js` 添加为脚本
3. 访问 ChatGPT 或 Claude 网站
4. 使用菜单 `AI Chat Extract - 配置面板` 设置 API Key
5. 使用 `AI Chat Extract - 立即导出` 或 `启动定时`

## 配置项

| 选项 | 说明 |
|------|------|
| OpenAI API Key | OpenAI API 密钥 (可选) |
| Claude API Key | Anthropic API 密钥 (可选) |
| 导出格式 | JSON 或 CSV |
| 定时间隔 | 分钟数 |
| 自动导出 | 是否自动下载导出文件 |

## 权限说明

| 权限 | 用途 |
|------|------|
| GM_xmlhttpRequest | API 请求 |
| GM_getValue/setValue | 本地存储配置 |
| GM_download | 下载导出文件 |
| @connect | 连接 API 域名 |

## 版本历史

- 0.0.1 - 初始版本，基础功能实现