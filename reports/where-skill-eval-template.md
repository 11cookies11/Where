# Where Skill Evaluation Template

## Scope

- Goal 1: Trigger correctness (precision/recall)
- Goal 2: Task completion quality
- Goal 3: Error recovery quality

## Inputs

- Testcases: `testcases/where-skill-prompts.jsonl`
- Runs: `testcases/where-skill-runs.jsonl`
- Evaluator: `scripts/eval-where-skill.ps1`

## Run Command

```powershell
powershell -ExecutionPolicy Bypass -File scripts/eval-where-skill.ps1 \
  -CasesPath testcases/where-skill-prompts.jsonl \
  -RunsPath testcases/where-skill-runs.jsonl \
  -OutPath reports/where-skill-eval-latest.md
```

## KPI Targets

- Precision >= 90%
- Recall >= 90%
- Task Success Rate >= 85%
- Recovery Success Rate >= 80%

## Analysis Checklist

- Top false positives and why they triggered incorrectly
- Top false negatives and missing trigger language
- Completion failures caused by formatting/state/ID handling
- Recovery failures by error type
- Recommended changes to frontmatter description
- Recommended changes to SKILL workflow instructions
- Recommended changes to references/error-handling.md
