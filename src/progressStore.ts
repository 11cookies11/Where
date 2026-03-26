import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  createNewHistoryEntryId,
  normalizeHistoryEntry,
  PlanHistoryEntry
} from "./historyHelpers";
import {
  ParseWarning,
  PlanData,
  TaskStatus,
  analyzeMarkdownPlanText,
  markerByStatus,
  parseMarkdownPlanText
} from "./progressParser";
import { isSameMtime } from "./fileVersion";
import {
  deleteTaskInSource,
  moveTaskIndentInSource,
  renameTaskInSource,
  setTaskStatusInSource
} from "./sourceEditor";

const DEFAULT_SOURCE_FILE = ".where-agent-progress.md";
const DEFAULT_HISTORY_FILE = ".where-history.json";
const AGENTS_FILE_NAME = "AGENTS.md";
const DEFAULT_TITLE = "Agent Plan";

type PlanHistoryFile = {
  version: 1;
  entries: PlanHistoryEntry[];
};

export class ProgressStore {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.onDidChangeEmitter.event;
  private lastObservedSourceText: string | null = null;
  private lastObservedTitle: string = DEFAULT_TITLE;

  public notifyChanged(): void {
    this.onDidChangeEmitter.fire();
  }

  public async loadPlan(): Promise<PlanData | null> {
    const filePath = this.resolveSourceFilePath();
    if (!filePath) {
      return null;
    }

    try {
      const text = await fs.readFile(filePath, "utf8");
      const stat = await fs.stat(filePath);
      const updatedAt = stat.mtime.toISOString();
      this.syncObservedSourceSnapshot(text);
      return this.parseMarkdownPlan(text, updatedAt);
    } catch {
      this.lastObservedSourceText = null;
      this.lastObservedTitle = DEFAULT_TITLE;
      return null;
    }
  }

  public async ensureSourceTemplate(): Promise<{ filePath: string; created: boolean }> {
    const filePath = this.resolveSourceFilePath();
    if (!filePath) {
      throw new Error("Open a workspace folder first.");
    }
    try {
      await fs.access(filePath);
      return { filePath, created: false };
    } catch {
      const template = defaultPlanTemplate("Where Plugin Progress");
      await fs.writeFile(filePath, `${template}\n`, "utf8");
      this.syncObservedSourceSnapshot(`${template}\n`);
      this.notifyChanged();
      return { filePath, created: true };
    }
  }

  public async resetSourcePlan(title?: string): Promise<void> {
    const filePath = this.resolveSourceFilePath();
    if (!filePath) {
      throw new Error("Open a workspace folder first.");
    }
    const nextTitle = title?.trim() || DEFAULT_TITLE;
    const nextText = `${defaultPlanTemplate(nextTitle)}\n`;
    await fs.writeFile(filePath, nextText, "utf8");
    this.syncObservedSourceSnapshot(nextText);
    this.notifyChanged();
  }

  public async ensureAgentsInstructionFile(): Promise<{ filePath: string; created: boolean }> {
    const filePath = this.resolveAgentsFilePath();
    if (!filePath) {
      throw new Error("Open a workspace folder first.");
    }

    try {
      await fs.access(filePath);
      return { filePath, created: false };
    } catch {
      const template = await this.loadAgentsTemplate();
      await fs.writeFile(filePath, `${template}\n`, "utf8");
      return { filePath, created: true };
    }
  }

  public async appendTaskToSource(title: string, status: TaskStatus): Promise<void> {
    const filePath = this.resolveSourceFilePath();
    if (!filePath) {
      throw new Error("Open a workspace folder first.");
    }

    try {
      await fs.access(filePath);
    } catch {
      await this.ensureSourceTemplate();
    }

    await this.writeSourceWithRetry(filePath, (sourceText) => {
      const marker = markerByStatus(status);
      const nextLine = `- [${marker}] ${title.trim()} <!-- where:id:${newTaskId()} -->`;
      const normalized = sourceText.endsWith("\n") ? sourceText : `${sourceText}\n`;
      return `${normalized}${nextLine}\n`;
    });

    this.notifyChanged();
  }

  public async setTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    await this.editSource((source) => setTaskStatusInSource(source, taskId, status));
  }

  public async renameTask(taskId: string, title: string): Promise<void> {
    await this.editSource((source) => renameTaskInSource(source, taskId, title));
  }

  public async deleteTask(taskId: string): Promise<void> {
    await this.editSource((source) => deleteTaskInSource(source, taskId));
  }

  public async promoteTask(taskId: string): Promise<void> {
    await this.editSource((source) => moveTaskIndentInSource(source, taskId, "promote"));
  }

  public async demoteTask(taskId: string): Promise<void> {
    await this.editSource((source) => moveTaskIndentInSource(source, taskId, "demote"));
  }

  public async validateSource(): Promise<ParseWarning[]> {
    const source = await this.readSourceText();
    return analyzeMarkdownPlanText(source);
  }

  public async archiveCurrentPlan(): Promise<{ filePath: string; title: string; archivedAt: string }> {
    const sourcePath = this.resolveSourceFilePath();
    const historyPath = this.resolveHistoryFilePath();
    if (!sourcePath || !historyPath) {
      throw new Error("Open a workspace folder first.");
    }

    const source = await this.readSourceText();
    const title = this.extractTitle(source);
    const archivedAt = await this.archiveSnapshot(historyPath, sourcePath, source, title);
    return { filePath: historyPath, title, archivedAt };
  }

  public async listArchivedPlans(): Promise<PlanHistoryEntry[]> {
    const historyPath = this.resolveHistoryFilePath();
    if (!historyPath) {
      throw new Error("Open a workspace folder first.");
    }
    const history = await this.readHistoryFile(historyPath);
    return [...history.entries].sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
  }

  public async deleteArchivedPlan(entryId: string): Promise<boolean> {
    const historyPath = this.resolveHistoryFilePath();
    if (!historyPath) {
      throw new Error("Open a workspace folder first.");
    }

    const history = await this.readHistoryFile(historyPath);
    const index = history.entries.findIndex((entry) => entry.id === entryId);
    if (index < 0) {
      return false;
    }

    history.entries.splice(index, 1);
    await this.writeHistoryFile(historyPath, history);
    return true;
  }

  public async restoreArchivedPlan(entryId: string): Promise<{ filePath: string; title: string; archivedAt: string }> {
    const sourcePath = this.resolveSourceFilePath();
    const historyPath = this.resolveHistoryFilePath();
    if (!sourcePath || !historyPath) {
      throw new Error("Open a workspace folder first.");
    }

    const history = await this.readHistoryFile(historyPath);
    const entry = history.entries.find((item) => item.id === entryId);
    if (!entry) {
      throw new Error("Archived plan not found.");
    }

    try {
      await fs.access(sourcePath);
    } catch {
      const restoredText = `${entry.snapshot.trimEnd()}\n`;
      await fs.writeFile(sourcePath, restoredText, "utf8");
      this.syncObservedSourceSnapshot(restoredText);
      this.notifyChanged();
      return { filePath: sourcePath, title: entry.title, archivedAt: entry.archivedAt };
    }

    await this.writeSourceWithRetry(sourcePath, () => `${entry.snapshot.trimEnd()}\n`);
    this.notifyChanged();
    return { filePath: sourcePath, title: entry.title, archivedAt: entry.archivedAt };
  }

  public async primeObservedSourceSnapshot(): Promise<void> {
    const source = await this.readSourceTextIfExists();
    this.syncObservedSourceSnapshot(source);
  }

  public async handleObservedSourceChange(): Promise<void> {
    const sourcePath = this.resolveSourceFilePath();
    if (!sourcePath) {
      return;
    }

    const current = await this.readSourceTextIfExists();
    const shouldArchive = this.shouldAutoArchiveHistory();
    if (shouldArchive && this.lastObservedSourceText && current !== this.lastObservedSourceText) {
      const historyPath = this.resolveHistoryFilePath();
      if (historyPath) {
        await this.archiveSnapshot(
          historyPath,
          sourcePath,
          this.lastObservedSourceText,
          this.lastObservedTitle
        );
      }
    }

    this.syncObservedSourceSnapshot(current);
  }

  public resolveSourceUri(): vscode.Uri | null {
    const filePath = this.resolveSourceFilePath();
    if (!filePath) {
      return null;
    }
    return vscode.Uri.file(filePath);
  }

  public resolveHistoryUri(): vscode.Uri | null {
    const filePath = this.resolveHistoryFilePath();
    if (!filePath) {
      return null;
    }
    return vscode.Uri.file(filePath);
  }

  private parseMarkdownPlan(text: string, updatedAt: string): PlanData {
    return parseMarkdownPlanText(text, updatedAt, DEFAULT_TITLE);
  }

  private resolveSourceFilePath(): string | null {
    const root = this.resolveWorkspaceRootPath();
    if (!root) {
      return null;
    }
    const config = vscode.workspace.getConfiguration("where");
    const configured = config.get<string>("sourceFile")?.trim() || DEFAULT_SOURCE_FILE;
    return path.join(root, configured);
  }

  private async editSource(mutator: (source: string) => string): Promise<void> {
    const filePath = this.resolveSourceFilePath();
    if (!filePath) {
      throw new Error("Open a workspace folder first.");
    }

    try {
      await fs.access(filePath);
    } catch {
      await this.ensureSourceTemplate();
    }

    await this.writeSourceWithRetry(filePath, mutator);
    this.notifyChanged();
  }

  private async readSourceText(): Promise<string> {
    const filePath = this.resolveSourceFilePath();
    if (!filePath) {
      throw new Error("Open a workspace folder first.");
    }

    try {
      return await fs.readFile(filePath, "utf8");
    } catch {
      await this.ensureSourceTemplate();
      return await fs.readFile(filePath, "utf8");
    }
  }

  private async readSourceTextIfExists(): Promise<string | null> {
    const filePath = this.resolveSourceFilePath();
    if (!filePath) {
      return null;
    }

    try {
      return await fs.readFile(filePath, "utf8");
    } catch {
      return null;
    }
  }

  private async writeSourceWithRetry(
    filePath: string,
    mutator: (source: string) => string
  ): Promise<void> {
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const source = await fs.readFile(filePath, "utf8");
      const snapshot = await fs.stat(filePath);
      const next = mutator(source);
      const current = await fs.stat(filePath);
      if (!isSameMtime(snapshot.mtimeMs, current.mtimeMs)) {
        if (attempt < maxAttempts) {
          continue;
        }
        throw new Error("Source file changed during update. Please retry.");
      }
      await fs.writeFile(filePath, next, "utf8");
      this.syncObservedSourceSnapshot(next);
      return;
    }
  }

  private resolveAgentsFilePath(): string | null {
    const root = this.resolveWorkspaceRootPath();
    if (!root) {
      return null;
    }
    return path.join(root, AGENTS_FILE_NAME);
  }

  private resolveHistoryFilePath(): string | null {
    const root = this.resolveWorkspaceRootPath();
    if (!root) {
      return null;
    }
    return path.join(root, this.getHistoryFileSetting());
  }

  private resolveWorkspaceRootPath(): string | null {
    const folder = vscode.workspace.workspaceFolders?.[0];
    return folder?.uri.fsPath ?? null;
  }

  private getHistoryFileSetting(): string {
    const config = vscode.workspace.getConfiguration("where");
    return config.get<string>("historyFile")?.trim() || DEFAULT_HISTORY_FILE;
  }

  private shouldAutoArchiveHistory(): boolean {
    const config = vscode.workspace.getConfiguration("where");
    return config.get<boolean>("history.autoArchive", true);
  }

  private async readHistoryFile(filePath: string): Promise<PlanHistoryFile> {
    try {
      const text = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(text) as Partial<PlanHistoryFile>;
      if (parsed.version === 1 && Array.isArray(parsed.entries)) {
        return {
          version: 1,
          entries: parsed.entries
            .filter((entry): entry is PlanHistoryEntry => isValidHistoryEntry(entry))
            .map((entry, index) => normalizeHistoryEntry(entry, index))
        };
      }
      throw new Error("Invalid history file format.");
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return { version: 1, entries: [] };
      }
      if (error instanceof SyntaxError) {
        throw new Error("History file is not valid JSON. Please fix or remove it.");
      }
      if (error instanceof Error && error.message === "Invalid history file format.") {
        throw error;
      }
      throw new Error("Failed to read history file.");
    }
  }

  private async writeHistoryFile(filePath: string, history: PlanHistoryFile): Promise<void> {
    await fs.writeFile(filePath, `${JSON.stringify(history, null, 2)}\n`, "utf8");
  }

  private syncObservedSourceSnapshot(sourceText: string | null): void {
    this.lastObservedSourceText = sourceText;
    this.lastObservedTitle = sourceText ? this.extractTitle(sourceText) : DEFAULT_TITLE;
  }

  private extractTitle(sourceText: string): string {
    const plan = parseMarkdownPlanText(sourceText, new Date().toISOString(), DEFAULT_TITLE);
    return plan.title.trim() || DEFAULT_TITLE;
  }

  private async archiveSnapshot(
    historyPath: string,
    sourcePath: string,
    snapshot: string,
    title: string
  ): Promise<string> {
    const current = await this.readHistoryFile(historyPath);
    const archivedAt = new Date().toISOString();
    current.entries.push({
      id: createNewHistoryEntryId(),
      archivedAt,
      title: title.trim() || DEFAULT_TITLE,
      sourceFile: path.basename(sourcePath),
      snapshot: snapshot.trimEnd()
    });
    await this.writeHistoryFile(historyPath, current);
    return archivedAt;
  }

  public shouldCreateAgentsOnInit(): boolean {
    const config = vscode.workspace.getConfiguration("where");
    return config.get<boolean>("init.createAgents", true);
  }

  private async loadAgentsTemplate(): Promise<string> {
    const config = vscode.workspace.getConfiguration("where");
    const templatePath = config.get<string>("init.agentsTemplatePath")?.trim();
    if (!templatePath) {
      return defaultAgentsTemplate();
    }

    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return defaultAgentsTemplate();
    }

    try {
      const fullPath = path.join(folder.uri.fsPath, templatePath);
      const text = await fs.readFile(fullPath, "utf8");
      if (text.trim()) {
        return text.trimEnd();
      }
      return defaultAgentsTemplate();
    } catch {
      return defaultAgentsTemplate();
    }
  }
}

export {
  ParseWarning,
  PlanData,
  Task,
  TaskStatus,
  parseMarkdownPlanText,
  statusLabel
} from "./progressParser";

export type { PlanHistoryEntry };

function defaultAgentsTemplate(): string {
  return [
    "# AGENTS.md",
    "",
    "This file defines repository-specific instructions for coding agents (including Codex).",
    "",
    "## Where Progress Contract",
    "",
    "- Source file: `where.sourceFile` (default: `.where-agent-progress.md`)",
    "- Format: **Markdown only** (JSON is not allowed)",
    "- Encoding: UTF-8",
    "",
    "Required structure:",
    "",
    "```md",
    "# Plan: <title>",
    "- [ ] <task>",
    "- [~] <task>",
    "- [!] <task>",
    "- [x] <task>",
    "```",
    "",
    "Status mapping:",
    "",
    "- `[ ]` -> `todo`",
    "- `[~]` -> `in_progress`",
    "- `[!]` -> `blocked`",
    "- `[x]` -> `done`",
    "",
    "## Agent Behavior",
    "",
    "- Keep one task per line.",
    "- Update existing tasks when status changes; avoid duplicate tasks.",
    "- Keep task titles short and actionable.",
    "- For blocked tasks, include blocker reason in the title.",
    "- Do not output JSON for progress data.",
    "- Do not add unrelated long prose in the progress file.",
    "",
    "## Reference",
    "",
    "- Detailed spec: `docs/AGENT_PROGRESS_SPEC.zh-CN.md`"
  ].join("\n");
}

function defaultPlanTemplate(title: string): string {
  return [
    `# Plan: ${title}`,
    "",
    "- [ ] Define goal and milestones",
    "- [~] Implement current feature",
    "- [!] Record blockers",
    "- [x] Mark finished tasks"
  ].join("\n");
}

function newTaskId(): string {
  return `where-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function isValidHistoryEntry(value: unknown): value is Omit<PlanHistoryEntry, "id"> & Partial<Pick<PlanHistoryEntry, "id">> {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Partial<PlanHistoryEntry>;
  return (
    (entry.id === undefined || typeof entry.id === "string") &&
    typeof entry.archivedAt === "string" &&
    typeof entry.title === "string" &&
    typeof entry.sourceFile === "string" &&
    typeof entry.snapshot === "string"
  );
}
