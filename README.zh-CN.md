# Where Progress（VS Code 扩展）

把本地 LLM agent 输出的进度文档，实时可视化到 VS Code。

语言：简体中文 | [English](README.md)

## 解决的问题

代理聊天信息很丰富，但项目进度不直观。这个扩展把“本地进度文档”直接展示为看板：

- Activity Bar 侧边栏任务列表（`Where`）
- Dashboard 完成率与状态统计
- 文档变更自动刷新
- 只读展示，以本地 agent 写入为唯一来源

## 文档驱动模式

扩展读取一个工作区内的源文件（默认：`.where-agent-progress.md`）。
你本地的 LLM agent 更新这个文件后，扩展会自动刷新。

支持格式：

1. Markdown（推荐）
```md
# Plan: VS Code Plugin Progress
- [ ] 定义里程碑
- [~] 实现解析器
- [!] 等待外部依赖
- [x] 发布 MVP
```

2. JSON
```json
{
  "title": "VS Code Plugin Progress",
  "tasks": [
    { "title": "定义里程碑", "status": "todo" },
    { "title": "实现解析器", "status": "in_progress" },
    { "title": "等待依赖", "status": "blocked" },
    { "title": "发布 MVP", "status": "done" }
  ]
}
```

状态映射：
- Markdown：`[ ]`=`todo`，`[~]`=`in_progress`，`[!]`=`blocked`，`[x]`=`done`
- JSON：`todo | in_progress | blocked | done`

## 配置源文件

在 VS Code 设置中配置：

- `where.sourceFile`（默认 `.where-agent-progress.md`）

## 开发脚手架

- TypeScript 构建链路（`tsconfig.json`、`npm run compile`、`npm run watch`）
- 调试与测试配置（`.vscode/launch.json`）
- 构建/测试任务（`.vscode/tasks.json`）
- 扩展测试框架（`@vscode/test-electron`、`src/test/**`）
- VSIX 打包脚本（`npm run package:vsix`）

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
4. 执行一次 `Where: Initialize Source File`。
5. 让本地 agent 持续更新源文件即可。

## 命令

- `Where: Initialize Source File`
- `Where: Open Source File`
- `Where: Open Progress Dashboard`
- `Where: Refresh Progress`

## 许可证

见 `LICENSE`。
