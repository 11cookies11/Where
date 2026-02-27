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
import {
  deleteTaskInSource,
  moveTaskIndentInSource,
  renameTaskInSource,
  setTaskStatusInSource
} from "./sourceEditor";

const DEFAULT_SOURCE_FILE = ".where-agent-progress.md";
const AGENTS_FILE_NAME = "AGENTS.md";
const DEFAULT_TITLE = "Agent Plan";

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
      const template = [
        "# Plan: Where Plugin Progress",
        "",
        "- [ ] Define goal and milestones",
        "- [~] Implement current feature",
        "- [!] Record blockers",
        "- [x] Mark finished tasks"
      ].join("\n");
      await fs.writeFile(filePath, `${template}\n`, "utf8");
      this.notifyChanged();
      return { filePath, created: true };
    }
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

    const sourceText = await fs.readFile(filePath, "utf8");
    const marker = markerByStatus(status);
    const nextLine = `- [${marker}] ${title.trim()} <!-- where:id:${newTaskId()} -->`;
    const normalized = sourceText.endsWith("\n") ? sourceText : `${sourceText}\n`;
    await fs.writeFile(filePath, `${normalized}${nextLine}\n`, "utf8");

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
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return null;
    }
    const config = vscode.workspace.getConfiguration("where");
    const configured = config.get<string>("sourceFile")?.trim() || DEFAULT_SOURCE_FILE;
    return path.join(folder.uri.fsPath, configured);
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

    const source = await this.readSourceText();
    const next = mutator(source);
    await fs.writeFile(filePath, next, "utf8");
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

  private resolveAgentsFilePath(): string | null {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return null;
    }
    return path.join(folder.uri.fsPath, AGENTS_FILE_NAME);
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

function newTaskId(): string {
  return `where-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
