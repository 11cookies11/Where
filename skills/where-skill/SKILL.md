---
name: where-skill
description: Manage planning and progress tracking for the Where extension using `.where-agent-progress.md`. Use when Codex needs to create a new plan, update task status, maintain indentation-based task hierarchy, keep one-task-per-line formatting, preserve existing task identity comments, and resolve blocked/in-progress transitions in multi-agent workflows.
---

# Where Skill

Keep the source-of-truth plan file valid, concise, and aligned with real execution.

## Use this workflow

1. Locate the plan file (default `.where-agent-progress.md`).
2. If missing, initialize from `assets/plan-template.md` or run `scripts/init_where_plan.ps1`.
3. Update existing task lines first; add new lines only when no existing task matches.
4. Keep status transitions explicit (`[ ] -> [~] -> [x]` or `[!]`).
5. Keep hierarchy stable with 2-space indentation increments.
6. Use indentation-based multi-level nesting for tree expand/collapse behavior.
7. Finish by validating format via `scripts/validate_where_plan.ps1`.
8. If validation fails or file state is inconsistent, follow `references/error-handling.md`.

## Enforce plan contract

- Keep Markdown only.
- Keep one task per line.
- Use status markers exactly: `[ ]`, `[~]`, `[!]`, `[x]`.
- Use spaces only; do not use tabs.
- Do not skip indentation levels.
- Keep task titles short and actionable.
- Include blocker reason in blocked task title.

## Preserve existing structure

- Preserve existing HTML ID comments when present, for example `<!-- where:id:xxx -->`.
- Do not duplicate a task line to represent status change; edit the original line.
- Prefer one active `[~]` parent task at a time unless parallel work is clearly intended.
- Mark completed parent and relevant children `[x]` together.

## Resolve common scenarios

- New request fits existing parent task: add a child task line under that parent.
- User asks for execution now: set the relevant task to `[~]` before edits.
- Task is complete: set parent and done children `[x]`, then move next target to `[~]`.
- Any parse/write/structure error: resolve using `references/error-handling.md`.

## Use bundled resources

- Read `references/where-progress-rules.md` for strict format and status rules.
- Read `references/workflow-recipes.md` for edit patterns and edge cases.
- Read `references/error-handling.md` for recovery steps and fallback strategy.
- Use `assets/plan-template.md` when creating or resetting a plan skeleton.
- Run `scripts/init_where_plan.ps1` to initialize a missing plan file.
- Run `scripts/validate_where_plan.ps1` after edits to catch format regressions.

## Validate before handoff

Run:

```powershell
powershell -ExecutionPolicy Bypass -File skills/where-skill/scripts/validate_where_plan.ps1 -PlanPath .where-agent-progress.md
```

Treat validation warnings as action items and fix the file before final response.
