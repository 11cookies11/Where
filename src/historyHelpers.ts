import { createHash, randomUUID } from "node:crypto";

export type PlanHistoryEntry = {
  id: string;
  archivedAt: string;
  title: string;
  sourceFile: string;
  snapshot: string;
};

export function createNewHistoryEntryId(): string {
  return `where-history-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function buildArchivedPlanPreviewMarkdown(entry: PlanHistoryEntry): string {
  return [
    `# Archived Plan Preview: ${entry.title}`,
    "",
    `- Archived At: ${entry.archivedAt}`,
    `- Source: ${entry.sourceFile}`,
    `- History ID: ${entry.id}`,
    "",
    "## Snapshot",
    "",
    entry.snapshot,
    ""
  ].join("\n");
}

export function normalizeHistoryEntry(
  entry: Omit<PlanHistoryEntry, "id"> & Partial<Pick<PlanHistoryEntry, "id">>,
  index: number
): PlanHistoryEntry {
  return {
    id: entry.id?.trim() || fallbackHistoryEntryId(entry, index),
    archivedAt: entry.archivedAt,
    title: entry.title,
    sourceFile: entry.sourceFile,
    snapshot: entry.snapshot
  };
}

function fallbackHistoryEntryId(
  entry: Pick<PlanHistoryEntry, "archivedAt" | "title" | "sourceFile">,
  index: number
): string {
  const seed = `${entry.archivedAt}|${entry.title}|${entry.sourceFile}|${index}`;
  return `where-history-${createHash("sha1").update(seed).digest("hex").slice(0, 12)}`;
}
