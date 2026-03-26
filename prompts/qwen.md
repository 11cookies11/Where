# Qwen Prompt Template

Maintain the Where progress source file (`where.sourceFile`, default `.where-agent-progress.md`) with strict Markdown structure.
History is enabled by default. If the plan is being overwritten or shortened, preserve the previous snapshot in history before replacing it.

Rules:
- Output Markdown only, UTF-8 encoded.
- First line must be `# Plan: <title>`.
- Each task line must match:
  - `- [ ] <title>`
  - `- [~] <title>`
  - `- [!] <title>`
  - `- [x] <title>`
- Use indentation to express parent-child tasks (recommend 2 spaces per level).
- Keep one task per line.
- Update existing tasks on status changes; avoid duplicate tasks.
- Archive the old snapshot before destructive rewrites.
- For blocked tasks, add blocker reason in title text.
- Do not output JSON or unrelated long prose.
- If this file conflicts with `AGENTS.md`, follow `AGENTS.md`.
