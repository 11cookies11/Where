# Where Progress Rules

## Status Mapping

- `[ ]` todo
- `[~]` in progress
- `[!]` blocked
- `[x]` done

## Required Structure

```md
# Plan: <title>
- [ ] <task>
  - [x] <subtask>
    - [ ] <nested-subtask>
- [~] <task>
- [!] <task>
- [x] <task>
```

## Format Rules

- Use Markdown only.
- Keep one task per line.
- Use spaces only for indentation.
- Prefer 2 spaces per hierarchy level.
- Do not skip indentation levels.
- Multi-level expand/collapse is derived from indentation depth.
- Do not use `<details>` or `<summary>`.
- Keep task titles short and actionable.
- Include blocker reason in blocked task title.

## Update Rules

1. Update existing task line when status changes.
2. Avoid duplicate tasks with the same meaning.
3. Preserve existing task ID comments when present.
4. Prefer one active `[~]` task unless explicit parallel execution is required.

## History Rules

- Update only the source plan file (default `.where-agent-progress.md`).
- Do not write history JSON directly.
- Use extension commands for history operations.
