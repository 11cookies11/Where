# Where Progress (VS Code Extension)

Visualize project progress from a local LLM agent Markdown document.

Language: English | [简体中文](README.zh-CN.md)

## What It Solves

Agent chat is rich, but progress is hard to scan. This extension turns your local agent progress Markdown file into a live dashboard inside VS Code.

- Sidebar task list in Activity Bar (`Where`)
- Dashboard with completion and status distribution
- Auto-refresh when source file changes
- Read-only visualization driven by local agent output

## Source-Driven Mode (Markdown Only)

The extension reads one workspace-local source file (default: `.where-agent-progress.md`).
Your local LLM agent updates this file, and the extension refreshes automatically.

Required format:

```md
# Plan: VS Code Plugin Progress
- [ ] Define milestones
  - [x] Draft milestone list
  - [~] Review milestone owners
- [~] Implement parser
- [!] Waiting for external dependency
- [x] Ship MVP
```

Nested subtasks are supported by indentation (recommend 2 spaces per level).

Status map:
- `[ ]` = `todo`
- `[~]` = `in_progress`
- `[!]` = `blocked`
- `[x]` = `done`

## Configure Source File

Set in VS Code settings:

- `where.sourceFile` (default: `.where-agent-progress.md`)
- `where.init.createAgents` (default: `true`)
- `where.init.agentsTemplatePath` (workspace-relative, optional)

Agent write spec:

- `docs/AGENT_PROGRESS_SPEC.zh-CN.md`

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
4. Run `Where: Initialize Source File` once (creates both `.where-agent-progress.md` and `AGENTS.md` if missing).
5. Let your local agent keep updating the source file.

One-click preview:

```bash
npm run preview
```

Skip reinstall and preview faster:

```bash
npm run preview:fast
```

## Commands

- `Where: Initialize Source File`
- `Where: Open Source File`
- `Where: Write Task To Source`
- `Where: Open Progress Dashboard`
- `Where: Refresh Progress`

## Testing

- `npm test`: run comprehensive unit tests (parser + hierarchy + status mapping)
- `npm run test:integration`: run VS Code extension host integration tests
- `npm run test:all`: run unit + integration tests

## License

See `LICENSE`.
