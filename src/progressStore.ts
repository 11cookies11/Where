import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  PlanData,
  TaskStatus,
  markerByStatus,
  parseMarkdownPlanText
} from "./progressParser";

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
      const template = [
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
    const nextLine = `- [${marker}] ${title.trim()}`;
    const normalized = sourceText.endsWith("\n") ? sourceText : `${sourceText}\n`;
    await fs.writeFile(filePath, `${normalized}${nextLine}\n`, "utf8");

    this.notifyChanged();
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

  private resolveAgentsFilePath(): string | null {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return null;
    }
    return path.join(folder.uri.fsPath, AGENTS_FILE_NAME);
  }
}

export { PlanData, Task, TaskStatus, parseMarkdownPlanText, statusLabel } from "./progressParser";
