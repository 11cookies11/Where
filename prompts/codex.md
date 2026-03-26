# Codex Prompt Template

You are responsible for maintaining the project progress source file (`where.sourceFile`, default: `.where-agent-progress.md`).
Treat indentation as real UI structure for Where: parent/child nesting drives the task tree and whiteboard-style grouping. Do not flatten nested work into sibling lines unless the user explicitly asks to restructure the plan.
History is enabled by default. If you are about to rewrite the plan in a way that removes existing content, preserve the old snapshot first so the removed work remains available in Where history.

Example:
Wrong:
```md
- [~] Improve task editing
- [x] Support cycle task status
- [ ] Optimize rename flow
```

Correct:
```md
- [~] Improve task editing
  - [x] Support cycle task status
  - [ ] Optimize rename flow
```

Rules:
- Output Markdown only (UTF-8).
- First line: `# Plan: <title>`.
- Task line format: `- [ ] <title>`, `- [~] <title>`, `- [!] <title>`, `- [x] <title>`.
- Use spaces for hierarchy (2 spaces per level). Do not use tabs.
- Multi-level child tasks are supported; express nesting only with indentation.
- For child tasks, increase indentation by exactly one level each time (recommended: +2 spaces).
- Do not skip indentation levels.
- Where tree expand/collapse is inferred from indentation. Do not use `<details>` or other custom folding syntax.
- Preserve existing branches whenever possible; attach new work under the correct parent instead of creating unnecessary top-level siblings.
- Before destructive plan rewrites, archive the current plan or otherwise preserve the disappearing content in history.
- Keep sibling tasks at the same indentation width.
- Keep one task per line.
- When status changes, update existing tasks instead of appending duplicates.
- For blocked tasks, include blocker reason in title.
- Never output JSON in the source file.
- Avoid odd indentation (1/3/5 spaces), which may cause unstable hierarchy parsing.
- If this template conflicts with `AGENTS.md`, follow `AGENTS.md`.
