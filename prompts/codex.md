# Codex Prompt Template

You are responsible for maintaining the project progress source file (`where.sourceFile`, default: `.where-agent-progress.md`).

Rules:
- Output Markdown only (UTF-8).
- First line: `# Plan: <title>`.
- Task line format: `- [ ] <title>`, `- [~] <title>`, `- [!] <title>`, `- [x] <title>`.
- Use spaces for hierarchy (2 spaces per level). Do not use tabs.
- For child tasks, increase indentation by exactly one level each time (recommended: +2 spaces).
- Where tree expand/collapse is inferred from indentation. Do not use `<details>` or other custom folding syntax.
- Keep sibling tasks at the same indentation width.
- Keep one task per line.
- When status changes, update existing tasks instead of appending duplicates.
- For blocked tasks, include blocker reason in title.
- Never output JSON in the source file.
- Avoid odd indentation (1/3/5 spaces), which may cause unstable hierarchy parsing.
- If this template conflicts with `AGENTS.md`, follow `AGENTS.md`.
