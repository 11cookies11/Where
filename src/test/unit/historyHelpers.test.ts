import * as assert from "node:assert";
import { buildArchivedPlanPreviewMarkdown, normalizeHistoryEntry } from "../../historyHelpers";

suite("Plan History Helper Unit Tests", () => {
  test("normalizes legacy archived entries with a stable fallback id", () => {
    const entry = normalizeHistoryEntry(
      {
        archivedAt: "2026-03-27T00:00:00.000Z",
        title: "Release Notes Draft",
        sourceFile: ".where-agent-progress.md",
        snapshot: "# Plan: Release Notes Draft\n- [x] Draft outline"
      },
      0
    );

    assert.ok(entry.id.startsWith("where-history-"));
    assert.strictEqual(entry.title, "Release Notes Draft");
  });

  test("keeps explicit archived entry ids intact", () => {
    const entry = normalizeHistoryEntry(
      {
        id: "where-history-custom",
        archivedAt: "2026-03-27T00:00:00.000Z",
        title: "Saved Plan",
        sourceFile: ".where-agent-progress.md",
        snapshot: "# Plan: Saved Plan\n- [ ] Outline"
      },
      1
    );

    assert.strictEqual(entry.id, "where-history-custom");
  });

  test("builds a markdown preview for archived snapshots", () => {
    const preview = buildArchivedPlanPreviewMarkdown({
      id: "where-history-custom",
      archivedAt: "2026-03-27T00:00:00.000Z",
      title: "Saved Plan",
      sourceFile: ".where-agent-progress.md",
      snapshot: "# Plan: Saved Plan\n- [ ] Outline"
    });

    assert.ok(preview.includes("# Archived Plan Preview: Saved Plan"));
    assert.ok(preview.includes("- History ID: where-history-custom"));
    assert.ok(preview.includes("## Snapshot"));
    assert.ok(preview.includes("- [ ] Outline"));
  });
});
