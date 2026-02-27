# Gemini Prompt Template

Update the local progress source file for Where (`where.sourceFile`, default `.where-agent-progress.md`).

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
- Include blocker cause in blocked task titles.
- Do not output JSON.
- If instructions differ, treat `AGENTS.md` as authoritative.
