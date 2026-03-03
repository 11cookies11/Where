import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
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

type PlanHistoryEntry = {
  archivedAt: string;
  title: string;
  sourceFile: string;
  snapshot: string;
};

type PlanHistoryFile = {
  version: 1;
  entries: PlanHistoryEntry[];
};

export class ProgressStore {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.onDidChangeEmitter.event;

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
      return this.parseMarkdownPlan(text, updatedAt);
    } catch {
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
    await fs.writeFile(filePath, `${defaultPlanTemplate(nextTitle)}\n`, "utf8");
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
    const plan = parseMarkdownPlanText(source, new Date().toISOString(), DEFAULT_TITLE);
    const title = plan.title.trim() || DEFAULT_TITLE;
    const archivedAt = new Date().toISOString();
    const current = await this.readHistoryFile(historyPath);
    current.entries.push({
      archivedAt,
      title,
      sourceFile: path.basename(sourcePath),
      snapshot: source.trimEnd()
    });
    await fs.writeFile(historyPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
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

  public resolveSourceUri(): vscode.Uri | null {
    const filePath = this.resolveSourceFilePath();
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

  private async readHistoryFile(filePath: string): Promise<PlanHistoryFile> {
    try {
      const text = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(text) as Partial<PlanHistoryFile>;
      if (parsed.version === 1 && Array.isArray(parsed.entries)) {
        return {
          version: 1,
          entries: parsed.entries
            .filter((entry): entry is PlanHistoryEntry => isValidHistoryEntry(entry))
            .map((entry) => ({
              archivedAt: entry.archivedAt,
              title: entry.title,
              sourceFile: entry.sourceFile,
              snapshot: entry.snapshot
            }))
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

function isValidHistoryEntry(value: unknown): value is PlanHistoryEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Partial<PlanHistoryEntry>;
  return (
    typeof entry.archivedAt === "string" &&
    typeof entry.title === "string" &&
    typeof entry.sourceFile === "string" &&
    typeof entry.snapshot === "string"
  );
}
