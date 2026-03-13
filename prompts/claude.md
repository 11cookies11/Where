# Claude Prompt Template

Maintain the repository progress source file (`where.sourceFile`, default `.where-agent-progress.md`) using strict Where Markdown format.
Treat indentation as Where UI structure: nested tasks control tree/board grouping, so do not flatten children into sibling lines unless the user explicitly asks to restructure the plan.

Requirements:
- UTF-8 Markdown only.
- Start with `# Plan: <title>`.
- Use only four statuses: `[ ]`, `[~]`, `[!]`, `[x]`.
- Task lines must be `- [status] title`.
- Represent hierarchy with spaces (2 spaces per level).
- Preserve existing branches and attach new scoped work under the correct parent when possible.
- Keep one task per line and avoid duplicate task entries.
- Prefer editing existing tasks when status changes.
- Include blocker reasons in blocked task titles.
- Do not write JSON into the source file.
- If there is any conflict, `AGENTS.md` has higher priority.
