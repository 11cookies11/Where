# Where（VS Code 扩展）

把本地 LLM agent 输出的 Markdown 进度文档，实时可视化到 VS Code。

[![CI Tests](https://github.com/11cookies11/Where/actions/workflows/ci-tests.yml/badge.svg?branch=main)](https://github.com/11cookies11/Where/actions/workflows/ci-tests.yml)
[![Release VSIX](https://github.com/11cookies11/Where/actions/workflows/release-vsix.yml/badge.svg)](https://github.com/11cookies11/Where/actions/workflows/release-vsix.yml)
[![Publish Marketplace](https://github.com/11cookies11/Where/actions/workflows/publish-marketplace.yml/badge.svg)](https://github.com/11cookies11/Where/actions/workflows/publish-marketplace.yml)

## 语言模式

本项目提供双语文档：

- 简体中文：`README.zh-CN.md`（当前文件）
- English: [README.md](README.md)

## 解决的问题

代理聊天信息很丰富，但项目进度不直观。这个扩展把“本地进度 Markdown 文档”直接展示为看板：

- Activity Bar 侧边栏任务列表（`Where`）
- Dashboard 完成率与状态统计
- 文档变更自动刷新
- 可视化管理当前进度，并支持归档历史计划

## 文档驱动模式（仅 Markdown）

扩展读取一个工作区内的源文件（默认：`.where-agent-progress.md`）。
你本地的 LLM agent 更新这个文件后，扩展会自动刷新。

要求格式：

```md
# Plan: VS Code Plugin Progress
- [ ] 定义里程碑
  - [x] 输出里程碑清单
  - [~] 评审里程碑负责人
    - [ ] 确认前端负责人与后端负责人
- [~] 实现解析器
  - [x] 完成基础语法解析
  - [~] 补齐异常分支测试
- [!] 等待外部依赖
- [x] 发布 MVP
```

支持通过缩进表示子任务层级（建议每级 2 个空格）。
Where 侧边栏中的“折叠/展开”由层级自动生成，会自动形成多层级可折叠树，不需要写额外折叠语法。

多层级写法建议（尤其给 Codex）：
- 只用空格缩进，不用 Tab
- 每次只增加一级缩进（建议 +2 空格）
- 同级任务保持相同缩进
- 不要写 `<details>` / `<summary>` 作为折叠语法（Where 不按这个解析任务）

状态映射：
- `[ ]`=`todo`
- `[~]`=`in_progress`
- `[!]`=`blocked`
- `[x]`=`done`

## 配置源文件

在 VS Code 设置中配置：

- `where.sourceFile`（默认 `.where-agent-progress.md`）
- `where.init.createAgents`（默认 `true`）
- `where.init.agentsTemplatePath`（工作区相对路径，可选）
- `where.historyFile`（默认 `.where-history.json`）

Agent 写入规范文档：

- `docs/AGENT_PROGRESS_SPEC.zh-CN.md`
- `AGENTS.md`（仓库内通用协议，优先级高于具体 Agent 模板）
- `prompts/`（不同 Agent 的提示词适配模板）

## 快速开始

1. 安装依赖：
```bash
npm install
```
2. 编译：
```bash
npm run compile
```
3. 按 `F5` 启动 Extension Development Host。
4. 执行一次 `Where: Initialize Source File`（或 `Where: Init Source File`）（若缺失会同时创建 `.where-agent-progress.md` 和 `AGENTS.md`）。
5. 让本地 agent 持续更新源文件即可。

一键编译并预览：

```bash
npm run preview
```

跳过安装（更快）：

```bash
npm run preview:fast
```

## 命令

- `Where: Initialize Source File`
- `Where: Init Source File`（别名）
- `Where: Setup Skill For Current Project`
- `Where: Open Source File`
- `Where: Open Where Settings`
- `Where: Archive Current Plan`
- `Where: Query Plan History`
- `Where: Write Task To Source`
- `Where: Cycle Task Status`
- `Where: Set Task Status`
- `Where: Rename Task`
- `Where: Delete Task`
- `Where: Promote Task (Outdent)`
- `Where: Demote Task (Indent)`
- `Where: Validate Source File`
- `Where: Open Progress Dashboard`
- `Where: Refresh Progress`

`Where: Setup Skill For Current Project` 会在运行时让你选择 `Codex / Claude / Both / Generic`，并在 `.where/` 下生成对应接入指引。

## 测试

- `npm test`：运行完整单元测试（解析、层级、状态映射）
- `npm run test:integration`：运行 VS Code 扩展宿主集成测试（Windows 默认跳过，可设 `FORCE_INTEGRATION_TESTS=1` 强制执行）
- `npm run test:all`：运行单元 + 集成测试

## 许可证

见 `LICENSE`。

