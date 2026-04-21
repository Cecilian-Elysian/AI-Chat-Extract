# AI Chat Extract

定时摘取 AI 聊天记录并导出的脚本，运行于 ScriptCat 浏览器扩展。

## 功能

- 支持通义千问 (qianwen.com) 对话导出
- 支持夸克 (quark.cn) 对话导出
- 多种导出格式 (Markdown/JSON/CSV)
- 可配置定时任务
- 本地数据存储

## 使用方法

1. 安装 [ScriptCat](https://github.com/scriptcat-org/scriptcat) 浏览器扩展
2. 将 `ai-chat-extract.user.js` 添加为脚本
3. 访问通义千问或夸克网站
4. 点击右下角 📥 按钮打开配置面板
5. 点击 `获取Cookie` 按钮获取登录凭证
6. 使用 `立即导出` 或 `启动定时`

## 配置项

| 选项 | 说明 |
|------|------|
| 导出格式 | Markdown (.md)、JSON (.json) 或 CSV (.csv) |
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

- 1.0.2 - 修复版本号显示错误，增强错误处理
- 1.0.1 - 优化 Cookie 过期机制
- 1.0.0 - 初始版本，支持通义千问和夸克平台