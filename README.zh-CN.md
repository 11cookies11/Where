# Where Progress（VS Code 扩展）

把本地 LLM agent 输出的 Markdown 进度文档，实时可视化到 VS Code。

语言：简体中文 | [English](README.md)

## 解决的问题

代理聊天信息很丰富，但项目进度不直观。这个扩展把“本地进度 Markdown 文档”直接展示为看板：

- Activity Bar 侧边栏任务列表（`Where`）
- Dashboard 完成率与状态统计
- 文档变更自动刷新
- 只读展示，以本地 agent 写入为唯一来源

## 文档驱动模式（仅 Markdown）

扩展读取一个工作区内的源文件（默认：`.where-agent-progress.md`）。
你本地的 LLM agent 更新这个文件后，扩展会自动刷新。

要求格式：

```md
# Plan: VS Code Plugin Progress
- [ ] 定义里程碑
- [~] 实现解析器
- [!] 等待外部依赖
- [x] 发布 MVP
```

状态映射：
- `[ ]`=`todo`
- `[~]`=`in_progress`
- `[!]`=`blocked`
- `[x]`=`done`

## 配置源文件

在 VS Code 设置中配置：

- `where.sourceFile`（默认 `.where-agent-progress.md`）

Agent 写入规范文档：

- `docs/AGENT_PROGRESS_SPEC.zh-CN.md`

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
- `Where: Write Task To Source`
- `Where: Open Progress Dashboard`
- `Where: Refresh Progress`

## 许可证

见 `LICENSE`。
