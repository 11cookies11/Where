import * as path from "path";

export type SkillSetupTarget = "codex" | "claude" | "both" | "generic";
export type SkillGuideType = "codex" | "claude" | "generic";

export function resolveSetupGuidePaths(
  workspacePath: string,
  target: SkillSetupTarget
): Array<{ filePath: string; type: SkillGuideType }> {
  const base = path.join(workspacePath, ".where");
  if (target === "codex") {
    return [{ filePath: path.join(base, "SKILL_SETUP.codex.md"), type: "codex" }];
  }
  if (target === "claude") {
    return [{ filePath: path.join(base, "SKILL_SETUP.claude.md"), type: "claude" }];
  }
  if (target === "both") {
    return [
      { filePath: path.join(base, "SKILL_SETUP.codex.md"), type: "codex" },
      { filePath: path.join(base, "SKILL_SETUP.claude.md"), type: "claude" }
    ];
  }
  return [{ filePath: path.join(base, "SKILL_SETUP.md"), type: "generic" }];
}

export function buildSkillSetupGuide(target: SkillGuideType): string {
  const header = [
    "# Where Skill Setup",
    "",
    "The project-local where-skill has been installed to:",
    "",
    "- `.where/skills/where-skill`",
    "",
    "## Notes",
    "",
    "- Keep `AGENTS.md` and this skill aligned.",
    "- Re-run `Where: Setup Skill For Current Project` after extension upgrades if needed.",
    ""
  ];

  if (target === "codex") {
    return [
      ...header,
      "## For Codex",
      "",
      "- Reference `.where/skills/where-skill` in your project instructions.",
      "- Ask Codex to use `where-skill` for `.where-agent-progress.md` updates.",
      "- Tell Codex that indentation controls Where tree/board layout, so nested tasks must stay nested instead of being flattened.",
      "- Prefer running `scripts/validate_where_plan.ps1` after plan edits.",
      "",
      "Example:",
      "",
      "Wrong:",
      "```md",
      "- [~] Improve task editing",
      "- [x] Support cycle task status",
      "- [ ] Optimize rename flow",
      "```",
      "",
      "Correct:",
      "```md",
      "- [~] Improve task editing",
      "  - [x] Support cycle task status",
      "  - [ ] Optimize rename flow",
      "```",
      ""
    ].join("\n");
  }

  if (target === "claude") {
    return [
      ...header,
      "## For Claude",
      "",
      "- Add `.where/skills/where-skill` to Claude local project context.",
      "- Trigger it for plan file edits, status transitions, and format recovery.",
      "- Keep task IDs and indentation hierarchy unchanged during edits.",
      ""
    ].join("\n");
  }

  return [
    ...header,
    "## Generic Setup",
    "",
    "- Point your AI agent to `.where/skills/where-skill`.",
    "- Use this skill only when editing `.where-agent-progress.md`.",
    "- Validate plan format after edits before final output.",
    ""
  ].join("\n");
}
