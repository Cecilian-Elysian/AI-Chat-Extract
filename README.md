# AI Chat Extract

定时摘取 AI 聊天记录并导出的脚本，运行于 ScriptCat/Tampermonkey 浏览器扩展。

## 功能

- 支持**通义千问** (qianwen.com) 对话导出
- 支持**夸克** (quark.cn) 对话导出
- **多种导出格式** (Markdown/JSON/CSV)
- **定时任务** - 可配置自动导出间隔
- **本地存储** - Cookie 和配置持久化
- **一键导出** - 支持 API 和 DOM 两种导出模式
- **实时日志** - 记录导出过程便于排查问题

## 支持平台

| 平台 | Cookie 获取 | API 导出 | DOM 导出 |
|------|-------------|----------|----------|
| 通义千问 | ✅ | ✅ | ✅ |
| 夸克 | ✅ | ✅ | ✅ |

## 使用方法

1. 安装 [ScriptCat](https://github.com/scriptcat-org/scriptcat) 或 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 将 `ai-chat-extract.user.js` 添加为脚本
3. 访问通义千问或夸克网站
4. 点击右下角 📥 按钮打开配置面板
5. 点击 `获取Cookie` 按钮获取登录凭证
6. 使用 `立即导出` 手动导出或 `启动定时` 自动导出

## 导出模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| API 导出 | 通过后台接口获取对话数据 | 推荐，速度快，数据完整 |
| DOM 导出 | 直接解析页面元素 | 接口失败时的备用方案 |

## 配置项

| 选项 | 说明 |
|------|------|
| 导出格式 | Markdown (.md)、JSON (.json) 或 CSV (.csv) |
| 定时间隔 | 分钟数（定时导出间隔）|
| 自动导出 | 启用后自动下载导出文件 |
| 平台选择 | 通义千问 / 夸克 |

## 权限说明

| 权限 | 用途 |
|------|------|
| GM_xmlhttpRequest | API 请求获取对话数据 |
| GM_getValue/setValue | 本地存储配置和 Cookie |
| GM_download | 下载导出文件 |
| GM_addElement/addStyle | 创建 UI 元素 |
| @connect | 连接 API 域名 |
| @run-at document-idle | 页面加载后运行 |

## 版本历史

- **1.0.3** - 优化导出逻辑，修复已知问题
- 1.0.2 - 修复版本号显示错误，增强错误处理
- 1.0.1 - 优化 Cookie 过期机制
- 1.0.0 - 初始版本，支持通义千问和夸克平台

## 许可证

MIT