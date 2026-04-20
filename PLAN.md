# 模块化开发计划

## 模块划分

| 模块 | 路径 | 职责 | 优先级 |
|------|------|------|--------|
| 核心模块 | src/core/ | 配置管理、提取器基类 | P0 |
| 平台层 | src/platforms/ | 各 AI 平台适配 | P0 |
| 导出模块 | src/export/ | 导出格式支持 | P0 |
| 调度模块 | src/scheduler/ | 定时任务管理 | P1 |
| 测试模块 | tests/ | 单元测试 | P1 |
| 主入口 | main.py | 应用入口 | P1 |

## 开发流程

### Phase 1: 核心框架 (当前版本 0.0.1)
- [x] 项目结构初始化
- [x] 配置模块 (Config)
- [x] 提取器基类 (ChatExtractor)
- [x] 导出模块 (JSON/CSV)
- [x] 调度模块
- [x] 单元测试基础覆盖
- [ ] → 提交: `git add . && git commit -m "feat: initial project structure"`

### Phase 2: 平台扩展 (0.0.2)
- [ ] 完善 OpenAI 平台 API 调用
- [ ] 添加 Claude 平台适配
- [ ] 扩展测试覆盖
- [ ] → 提交: `git commit -m "feat: add OpenAI and Claude platform support"`

### Phase 3: 功能增强 (0.0.3)
- [ ] 日志系统
- [ ] 命令行参数增强
- [ ] 错误重试机制
- [ ] → 提交: `git commit -m "feat: add logging and retry mechanism"`

### Phase 4: 生产就绪 (0.1.0)
- [ ] 配置验证
- [ ] 健康检查
- [ ] 完整的集成测试
- [ ] → 提交: `git commit -m "feat: production-ready with health checks"`

## 版本规则
- 默认增量: patch (+1, 0.0.1 → 0.0.2)
- 用户要求"中版本": minor (+0.1, 0.0.9 → 0.1.0)
- 用户要求"大版本": major (+1, 0.9.9 → 1.0.0)

## 当前版本: 0.0.1
