import * as assert from "node:assert";
import { normalizeTaskStatus, parseMarkdownPlanText } from "../../progressParser";

suite("Progress Parser Unit Tests", () => {
  const updatedAt = "2026-02-23T00:00:00.000Z";

  test("parses plan title and top-level tasks", () => {
    const source = [
      "# Plan: Where Test",
      "- [ ] Task A",
      "- [x] Task B"
    ].join("\n");

    const plan = parseMarkdownPlanText(source, updatedAt);
    assert.strictEqual(plan.title, "Where Test");
    assert.strictEqual(plan.tasks.length, 2);
    assert.strictEqual(plan.tasks[0].status, "todo");
    assert.strictEqual(plan.tasks[1].status, "done");
  });

  test("parses nested subtasks by indentation", () => {
    const source = [
      "# Plan: Hierarchy",
      "- [~] Parent",
      "  - [x] Child Done",
      "    - [ ] Grandchild Todo",
      "  - [!] Child Blocked",
      "- [ ] Sibling Parent"
    ].join("\n");

    const plan = parseMarkdownPlanText(source, updatedAt);
    assert.strictEqual(plan.tasks.length, 2);
    assert.strictEqual(plan.tasks[0].title, "Parent");
    assert.strictEqual(plan.tasks[0].children.length, 2);
    assert.strictEqual(plan.tasks[0].children[0].children.length, 1);
    assert.strictEqual(plan.tasks[0].children[0].children[0].title, "Grandchild Todo");
    assert.strictEqual(plan.tasks[0].children[1].status, "blocked");
  });

  test("supports textual status tokens in brackets", () => {
    const source = [
      "# Plan: Status Tokens",
      "- [todo] A",
      "- [in_progress] B",
      "- [blocked] C",
      "- [done] D"
    ].join("\n");

    const plan = parseMarkdownPlanText(source, updatedAt);
    assert.deepStrictEqual(
      plan.tasks.map((task) => task.status),
      ["todo", "in_progress", "blocked", "done"]
    );
  });

  test("uses stable id from where anchor", () => {
    const source = [
      "# Plan: Stable ID",
      "- [ ] Task A <!-- where:id:where-a1 -->",
      "- [x] Task B <!-- where:id:where-b2 -->"
    ].join("\n");

    const plan = parseMarkdownPlanText(source, updatedAt);
    assert.strictEqual(plan.tasks[0].id, "where-a1");
    assert.strictEqual(plan.tasks[1].id, "where-b2");
  });

  test("ignores malformed task lines", () => {
    const source = [
      "# Plan: Invalid Lines",
      "- [] missing",
      "- [x]",
      "random paragraph",
      "- [x] Valid one"
    ].join("\n");

    const plan = parseMarkdownPlanText(source, updatedAt);
    assert.strictEqual(plan.tasks.length, 1);
    assert.strictEqual(plan.tasks[0].title, "Valid one");
  });

  test("falls back to default title when title is missing", () => {
    const source = "- [ ] A\n- [x] B";
    const plan = parseMarkdownPlanText(source, updatedAt, "Fallback");
    assert.strictEqual(plan.title, "Fallback");
  });

  test("normalizeTaskStatus maps symbols and words", () => {
    assert.strictEqual(normalizeTaskStatus("x"), "done");
    assert.strictEqual(normalizeTaskStatus("done"), "done");
    assert.strictEqual(normalizeTaskStatus("~"), "in_progress");
    assert.strictEqual(normalizeTaskStatus("in_progress"), "in_progress");
    assert.strictEqual(normalizeTaskStatus("!"), "blocked");
    assert.strictEqual(normalizeTaskStatus("blocked"), "blocked");
    assert.strictEqual(normalizeTaskStatus("other"), "todo");
  });
});
