# Where Progress (VS Code Extension)

Visualize project progress from a local LLM agent source document.

Language: English | [简体中文](README.zh-CN.md)

## What It Solves

Agent chat is rich, but progress is hard to scan. This extension turns your local agent progress file into a live dashboard inside VS Code.

- Sidebar task list in Activity Bar (`Where`)
- Dashboard with completion and status distribution
- Auto-refresh when source file changes
- Read-only visualization driven by local agent output

## Source-Driven Mode

The extension reads one workspace-local source file (default: `.where-agent-progress.md`).
Your local LLM agent updates this file, and the extension refreshes automatically.

Supported formats:

1. Markdown (recommended)
```md
# Plan: VS Code Plugin Progress
- [ ] Define milestones
- [~] Implement parser
- [!] Waiting for external dependency
- [x] Ship MVP
```

2. JSON
```json
{
  "title": "VS Code Plugin Progress",
  "tasks": [
    { "title": "Define milestones", "status": "todo" },
    { "title": "Implement parser", "status": "in_progress" },
    { "title": "Waiting for dependency", "status": "blocked" },
    { "title": "Ship MVP", "status": "done" }
  ]
}
```

Status map:
- Markdown: `[ ]` = `todo`, `[~]` = `in_progress`, `[!]` = `blocked`, `[x]` = `done`
- JSON: `todo | in_progress | blocked | done`

## Configure Source File

Set in VS Code settings:

- `where.sourceFile` (default: `.where-agent-progress.md`)

## Development Scaffold

- TypeScript build pipeline (`tsconfig.json`, `npm run compile`, `npm run watch`)
- Debug and test launch configs (`.vscode/launch.json`)
- Build/test tasks (`.vscode/tasks.json`)
- Extension test harness (`@vscode/test-electron`, `src/test/**`)
- VSIX packaging script (`npm run package:vsix`)

## Quick Start

1. Install dependencies:
```bash
npm install
```
2. Compile:
```bash
npm run compile
```
3. Press `F5` to start Extension Development Host.
4. Run `Where: Initialize Source File` once.
5. Let your local agent keep updating the source file.

## Commands

- `Where: Initialize Source File`
- `Where: Open Source File`
- `Where: Open Progress Dashboard`
- `Where: Refresh Progress`

## License

See `LICENSE`.
