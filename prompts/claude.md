# Claude Prompt Template

Maintain the repository progress source file (`where.sourceFile`, default `.where-agent-progress.md`) using strict Where Markdown format.

Requirements:
- UTF-8 Markdown only.
- Start with `# Plan: <title>`.
- Use only four statuses: `[ ]`, `[~]`, `[!]`, `[x]`.
- Task lines must be `- [status] title`.
- Represent hierarchy with spaces (2 spaces per level).
- Keep one task per line and avoid duplicate task entries.
- Prefer editing existing tasks when status changes.
- Include blocker reasons in blocked task titles.
- Do not write JSON into the source file.
- If there is any conflict, `AGENTS.md` has higher priority.
