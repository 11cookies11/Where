# Codex Prompt Template

You are responsible for maintaining the project progress source file (`where.sourceFile`, default: `.where-agent-progress.md`).

Rules:
- Output Markdown only (UTF-8).
- First line: `# Plan: <title>`.
- Task line format: `- [ ] <title>`, `- [~] <title>`, `- [!] <title>`, `- [x] <title>`.
- Use indentation (2 spaces per level) for subtasks.
- Keep one task per line.
- When status changes, update existing tasks instead of appending duplicates.
- For blocked tasks, include blocker reason in title.
- Never output JSON in the source file.
- If this template conflicts with `AGENTS.md`, follow `AGENTS.md`.
