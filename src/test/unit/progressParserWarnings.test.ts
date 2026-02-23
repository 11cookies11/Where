import * as assert from "node:assert";
import { analyzeMarkdownPlanText } from "../../progressParser";

suite("Parser Warning Unit Tests", () => {
  test("detects tab and odd indentation", () => {
    const source = [
      "# Plan: Warn",
      "\t- [ ] Tab indented",
      "   - [ ] odd spaces"
    ].join("\n");
    const warnings = analyzeMarkdownPlanText(source);
    assert.ok(warnings.some((w) => w.code === "tab-indentation"));
    assert.ok(warnings.some((w) => w.code === "odd-indentation"));
  });

  test("detects invalid task lines and duplicate titles", () => {
    const source = [
      "# Plan: Warn",
      "- [ ] Duplicate",
      "- [ ] Duplicate",
      "- [unknown] wrong",
      "- [] empty"
    ].join("\n");
    const warnings = analyzeMarkdownPlanText(source);
    assert.ok(warnings.some((w) => w.code === "duplicate-task-title"));
    assert.ok(warnings.some((w) => w.code === "invalid-task-line"));
  });
});
