# Error Handling

## Scope

Use this guide when plan updates fail, validation reports errors, or task tree structure becomes inconsistent.

## Error Categories

### 1. Parse Errors

Symptoms:
- Task line does not match `- [ ] <title>` style.
- Mixed symbols or malformed status marker.

Recovery:
1. Normalize each task line to `- [ ]`, `- [~]`, `- [!]`, or `- [x]`.
2. Keep one task per line.
3. Re-run validation script.

### 2. Indentation Errors

Symptoms:
- Tabs used for indentation.
- Odd number of leading spaces.
- Child task appears without valid parent.
- Indentation skips levels.

Recovery:
1. Replace tabs with spaces.
2. Use 2 spaces per level.
3. Ensure each child task has a direct parent level.
4. Re-run validation script.

### 3. Status Conflicts

Symptoms:
- Multiple unrelated `[~]` tasks without explicit parallel intent.
- Completed parent still contains pending required children.

Recovery:
1. Keep one active `[~]` task unless parallel work is explicit.
2. Align parent status with children completion state.
3. Mark blockers with `[!]` and include reason.

### 4. Duplicate Task Lines

Symptoms:
- Same task title appears multiple times due to status transition edits.

Recovery:
1. Keep the original task line.
2. Merge updates into that line.
3. Remove accidental duplicates.

### 5. Missing Plan File

Symptoms:
- `.where-agent-progress.md` not found.

Recovery:
1. Run `scripts/init_where_plan.ps1`.
2. Or copy from `assets/plan-template.md`.
3. Reapply current task state.

## Validation Command

```powershell
powershell -ExecutionPolicy Bypass -File skills/where-skill/scripts/validate_where_plan.ps1 -PlanPath .where-agent-progress.md
```

## Escalation Rule

If repeated edits still fail validation:
1. Backup current plan file.
2. Rebuild structure from `assets/plan-template.md`.
3. Reinsert tasks branch by branch.
4. Validate after each branch insertion.
