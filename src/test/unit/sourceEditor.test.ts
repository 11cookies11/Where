import * as assert from "node:assert";
import {
  deleteTaskInSource,
  moveTaskIndentInSource,
  renameTaskInSource,
  setTaskStatusInSource
} from "../../sourceEditor";

suite("Source Editor Unit Tests", () => {
  const base = [
    "# Plan: Edit",
    "- [ ] Parent",
    "  - [~] Child A",
    "  - [!] Child B",
    "- [x] Other"
  ].join("\n");

  test("setTaskStatus updates marker", () => {
    const next = setTaskStatusInSource(base, "task-2", "done");
    assert.ok(next.includes("  - [x] Child A"));
  });

  test("renameTask updates title", () => {
    const next = renameTaskInSource(base, "task-3", "Blocked child renamed");
    assert.ok(next.includes("  - [!] Blocked child renamed"));
  });

  test("deleteTask removes block with descendants", () => {
    const next = deleteTaskInSource(base, "task-1");
    assert.ok(!next.includes("Parent"));
    assert.ok(!next.includes("Child A"));
    assert.ok(next.includes("- [x] Other"));
  });

  test("promoteTask outdents task block", () => {
    const next = moveTaskIndentInSource(base, "task-2", "promote");
    assert.ok(next.includes("- [~] Child A"));
  });

  test("demoteTask indents task block", () => {
    const source = [
      "# Plan: Move",
      "- [ ] A",
      "- [ ] B"
    ].join("\n");
    const next = moveTaskIndentInSource(source, "task-2", "demote");
    assert.ok(next.includes("  - [ ] B"));
  });
});
