import * as vscode from "vscode";
import { PlanData, ProgressStore, Task, statusLabel } from "./progressStore";

class ProgressItem extends vscode.TreeItem {
  constructor(public readonly kind: "meta" | "task", label: string, status?: Task["status"]) {
    super(label, vscode.TreeItemCollapsibleState.None);

    if (kind === "task" && status) {
      this.contextValue = "where.taskReadonly";
      this.description = statusLabel(status);
      this.iconPath = iconByStatus(status);
      this.tooltip = `${label}\nStatus: ${statusLabel(status)}`;
    } else {
      this.contextValue = "where.meta";
      this.iconPath = new vscode.ThemeIcon("info");
    }
  }
}

class ProgressTreeDataProvider implements vscode.TreeDataProvider<ProgressItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly store: ProgressStore) {
    this.store.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  async getChildren(): Promise<ProgressItem[]> {
    const plan = await this.store.loadPlan();
    if (!plan) {
      return [new ProgressItem("meta", "No source data. Run: Where: Initialize Source File")];
    }

    const done = plan.tasks.filter((task) => task.status === "done").length;
    const percent = plan.tasks.length === 0 ? 0 : Math.round((done / plan.tasks.length) * 100);
    const summary = new ProgressItem("meta", `${plan.title} (${percent}%)`);
    summary.description = `${done}/${plan.tasks.length} done`;
    summary.iconPath = new vscode.ThemeIcon("graph");

    const tasks = plan.tasks.map((task) => new ProgressItem("task", task.title, task.status));
    return [summary, ...tasks];
  }

  getTreeItem(element: ProgressItem): vscode.TreeItem {
    return element;
  }
}

let dashboardPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const store = new ProgressStore();
  const provider = new ProgressTreeDataProvider(store);
  let watcher: vscode.FileSystemWatcher | undefined;

  const setupWatcher = (): void => {
    watcher?.dispose();
    const config = vscode.workspace.getConfiguration("where");
    const sourceFile = config.get<string>("sourceFile")?.trim() || ".where-agent-progress.md";
    watcher = vscode.workspace.createFileSystemWatcher(`**/${sourceFile}`);
    const onSourceChange = () => store.notifyChanged();
    watcher.onDidChange(onSourceChange, undefined, context.subscriptions);
    watcher.onDidCreate(onSourceChange, undefined, context.subscriptions);
    watcher.onDidDelete(onSourceChange, undefined, context.subscriptions);
    context.subscriptions.push(watcher);
  };
  setupWatcher();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("where.projectProgress", provider),
    vscode.commands.registerCommand("where.refreshProgress", () => store.notifyChanged()),
    vscode.commands.registerCommand("where.initializeSourceFile", async () => {
      const filePath = await store.ensureSourceTemplate();
      const uri = vscode.Uri.file(filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: false });
      vscode.window.showInformationMessage("Source file ready.");
    }),
    vscode.commands.registerCommand("where.openSourceFile", async () => {
      const uri = store.resolveSourceUri();
      if (!uri) {
        return;
      }
      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: false });
      } catch {
        const pick = await vscode.window.showWarningMessage(
          "Source file does not exist yet.",
          "Create Source File"
        );
        if (pick === "Create Source File") {
          await vscode.commands.executeCommand("where.initializeSourceFile");
        }
      }
    }),
    vscode.commands.registerCommand("where.writeTaskToSource", async () => {
      const title = await vscode.window.showInputBox({
        prompt: "Task title to write into source file",
        placeHolder: "Example: Implement message parser for local agent logs"
      });
      if (!title?.trim()) {
        return;
      }

      const picked = await vscode.window.showQuickPick(
        [
          { label: "Todo", value: "todo" },
          { label: "In Progress", value: "in_progress" },
          { label: "Blocked", value: "blocked" },
          { label: "Done", value: "done" }
        ],
        { placeHolder: "Task status" }
      );
      if (!picked) {
        return;
      }

      try {
        await store.appendTaskToSource(title, picked.value as Task["status"]);
        vscode.window.showInformationMessage("Task written to source file.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to write source file.";
        vscode.window.showErrorMessage(message);
      }
    }),
    vscode.commands.registerCommand("where.openDashboard", async () => {
      if (!dashboardPanel) {
        dashboardPanel = vscode.window.createWebviewPanel(
          "where.dashboard",
          "Where Progress Dashboard",
          vscode.ViewColumn.Beside,
          { enableScripts: false }
        );
        dashboardPanel.onDidDispose(() => {
          dashboardPanel = undefined;
        });
      }
      await renderDashboard(dashboardPanel, store);
      dashboardPanel.reveal(vscode.ViewColumn.Beside);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("where.sourceFile")) {
        setupWatcher();
        store.notifyChanged();
      }
    })
  );

  store.onDidChange(async () => {
    provider.refresh();
    if (dashboardPanel) {
      await renderDashboard(dashboardPanel, store);
    }
  });
}

export function deactivate(): void {
  dashboardPanel?.dispose();
  dashboardPanel = undefined;
}

function iconByStatus(status: Task["status"]): vscode.ThemeIcon {
  switch (status) {
    case "done":
      return new vscode.ThemeIcon("check");
    case "in_progress":
      return new vscode.ThemeIcon("sync");
    case "blocked":
      return new vscode.ThemeIcon("warning");
    case "todo":
    default:
      return new vscode.ThemeIcon("circle-outline");
  }
}

async function renderDashboard(panel: vscode.WebviewPanel, store: ProgressStore): Promise<void> {
  const plan = await store.loadPlan();
  panel.webview.html = buildDashboardHtml(plan);
}

function buildDashboardHtml(plan: PlanData | null): string {
  if (!plan) {
    return `
      <!doctype html>
      <html lang="en">
      <body style="font-family: sans-serif; padding: 20px;">
        <h2>No source data yet</h2>
        <p>Run <code>Where: Initialize Source File</code> and let your local agent update it.</p>
      </body>
      </html>
    `;
  }

  const total = plan.tasks.length;
  const done = plan.tasks.filter((task) => task.status === "done").length;
  const inProgress = plan.tasks.filter((task) => task.status === "in_progress").length;
  const blocked = plan.tasks.filter((task) => task.status === "blocked").length;
  const todo = plan.tasks.filter((task) => task.status === "todo").length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const taskHtml = plan.tasks
    .map(
      (task) => `
      <tr>
        <td>${escapeHtml(task.title)}</td>
        <td>${statusLabel(task.status)}</td>
        <td>${new Date(task.updatedAt).toLocaleString()}</td>
      </tr>
    `
    )
    .join("");

  return `
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Where Progress Dashboard</title>
      <style>
        :root {
          color-scheme: light dark;
        }
        body {
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
          margin: 16px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(100px, 1fr));
          gap: 8px;
          margin-top: 16px;
        }
        .card {
          border: 1px solid rgba(127, 127, 127, 0.35);
          border-radius: 8px;
          padding: 10px;
        }
        .bar {
          width: 100%;
          height: 10px;
          border-radius: 999px;
          background: rgba(127, 127, 127, 0.25);
          overflow: hidden;
          margin: 8px 0 2px;
        }
        .bar > span {
          display: block;
          height: 100%;
          width: ${percent}%;
          background: #2e8b57;
        }
        table {
          width: 100%;
          margin-top: 16px;
          border-collapse: collapse;
        }
        th, td {
          border-bottom: 1px solid rgba(127, 127, 127, 0.3);
          text-align: left;
          padding: 8px 4px;
        }
      </style>
    </head>
    <body>
      <h2>${escapeHtml(plan.title)}</h2>
      <div>${done}/${total} tasks done</div>
      <div class="bar"><span></span></div>
      <div>${percent}% complete</div>

      <div class="grid">
        <div class="card"><strong>Todo</strong><div>${todo}</div></div>
        <div class="card"><strong>In Progress</strong><div>${inProgress}</div></div>
        <div class="card"><strong>Blocked</strong><div>${blocked}</div></div>
        <div class="card"><strong>Done</strong><div>${done}</div></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Status</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>${taskHtml}</tbody>
      </table>
    </body>
    </html>
  `;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
