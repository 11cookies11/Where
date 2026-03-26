# Gemini Prompt Template

Update the local progress source file for Where (`where.sourceFile`, default `.where-agent-progress.md`).
History is enabled by default. When a rewrite will remove existing items, keep the previous snapshot in history first.

Follow these constraints:
- Write UTF-8 Markdown only.
- Keep first line as `# Plan: <title>`.
- Task syntax must be one of:
  - `- [ ] <task>`
  - `- [~] <task>`
  - `- [!] <task>`
  - `- [x] <task>`
- Use 2-space indentation for nested subtasks.
- Keep one task per line.
- Modify existing task status rather than creating duplicate tasks.
- Preserve disappearing content by archiving before destructive rewrites.
- Include blocker cause in blocked task titles.
- Do not output JSON.
- If instructions differ, treat `AGENTS.md` as authoritative.
