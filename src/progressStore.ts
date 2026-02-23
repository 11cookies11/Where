import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  updatedAt: string;
}

export interface PlanData {
  title: string;
  updatedAt: string;
  tasks: Task[];
}

const DEFAULT_SOURCE_FILE = ".where-agent-progress.md";
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

  public async ensureSourceTemplate(): Promise<string> {
    const filePath = this.resolveSourceFilePath();
    if (!filePath) {
      throw new Error("Open a workspace folder first.");
    }
    try {
      await fs.access(filePath);
      return filePath;
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
      return filePath;
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

    for (const line of lines) {
      const titleMatch = line.match(/^#\s*(?:Plan:)?\s*(.+)\s*$/i);
      if (titleMatch && titleMatch[1].trim()) {
        title = titleMatch[1].trim();
        continue;
      }

      const taskMatch = line.match(
        /^[-*]\s+\[(x|~|!|\s|todo|in_progress|blocked|done)\]\s+(.+)$/i
      );
      if (!taskMatch) {
        continue;
      }
      const marker = taskMatch[1].trim().toLowerCase();
      const taskTitle = taskMatch[2].trim();
      if (!taskTitle) {
        continue;
      }
      tasks.push({
        id: `task-${tasks.length + 1}`,
        title: taskTitle,
        status: normalizeStatus(marker),
        updatedAt
      });
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
