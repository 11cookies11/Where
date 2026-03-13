import * as assert from "node:assert";
import * as path from "path";
import { buildSkillSetupGuide, resolveSetupGuidePaths } from "../../skillSetupGuide";

suite("Skill Setup Guide Unit Tests", () => {
  test("builds codex setup guide with hierarchy warning and examples", () => {
    const guide = buildSkillSetupGuide("codex");

    assert.ok(guide.includes("indentation controls Where tree/board layout"));
    assert.ok(guide.includes("Wrong:"));
    assert.ok(guide.includes("Correct:"));
    assert.ok(guide.includes("- [~] Improve task editing"));
    assert.ok(guide.includes("  - [x] Support cycle task status"));
  });

  test("resolves both setup guide paths", () => {
    const guides = resolveSetupGuidePaths("D:\\Repo", "both");

    assert.deepStrictEqual(guides, [
      { filePath: path.join("D:\\Repo", ".where", "SKILL_SETUP.codex.md"), type: "codex" },
      { filePath: path.join("D:\\Repo", ".where", "SKILL_SETUP.claude.md"), type: "claude" }
    ]);
  });
});
