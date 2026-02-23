import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  updatedAt: string;
  children: Task[];
}

export interface PlanData {
  title: string;
  updatedAt: string;
  tasks: Task[];
}

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
    const lines = text.split(/\r?\n/);
    let title = DEFAULT_TITLE;
    const tasks: Task[] = [];
    const stack: Array<{ indent: number; task: Task }> = [];
    let counter = 0;

    for (const line of lines) {
      const titleMatch = line.match(/^#\s*(?:Plan:)?\s*(.+)\s*$/i);
      if (titleMatch && titleMatch[1].trim()) {
        title = titleMatch[1].trim();
        continue;
      }

      const taskMatch = line.match(
        /^(\s*)[-*]\s+\[(x|~|!|\s|todo|in_progress|blocked|done)\]\s+(.+)$/i
      );
      if (!taskMatch) {
        continue;
      }
      const indent = taskMatch[1].length;
      const marker = taskMatch[2].trim().toLowerCase();
      const taskTitle = taskMatch[3].trim();
      if (!taskTitle) {
        continue;
      }
      counter += 1;
      const task: Task = {
        id: `task-${counter}`,
        title: taskTitle,
        status: normalizeStatus(marker),
        updatedAt,
        children: []
      };

      while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }

      if (stack.length === 0) {
        tasks.push(task);
      } else {
        stack[stack.length - 1].task.children.push(task);
      }
      stack.push({ indent, task });
    }

    return { title, updatedAt, tasks };
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

export function statusLabel(status: TaskStatus): string {
  switch (status) {
    case "todo":
      return "Todo";
    case "in_progress":
      return "In Progress";
    case "blocked":
      return "Blocked";
    case "done":
      return "Done";
    default:
      return status;
  }
}

function normalizeStatus(raw: unknown): TaskStatus {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "x" || value === "done") {
    return "done";
  }
  if (value === "~" || value === "in_progress") {
    return "in_progress";
  }
  if (value === "!" || value === "blocked") {
    return "blocked";
  }
  return "todo";
}

function markerByStatus(status: TaskStatus): " " | "~" | "!" | "x" {
  switch (status) {
    case "done":
      return "x";
    case "in_progress":
      return "~";
    case "blocked":
      return "!";
    case "todo":
    default:
      return " ";
  }
}
