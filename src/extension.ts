import * as vscode from "vscode";
import * as path from "path";
import { promises as fs } from "fs";
import { PlanData, ProgressStore, Task, statusLabel } from "./progressStore";

class ProgressItem extends vscode.TreeItem {
  constructor(
    public readonly kind: "meta" | "task",
    label: string,
    public readonly task?: Task
  ) {
    super(
      label,
      task && task.children.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    if (kind === "task" && task) {
      this.contextValue = "where.task";
      this.iconPath = iconByStatus(task.status);
      this.tooltip = `${label}\nStatus: ${statusLabel(task.status)}`;
      this.command = {
        command: "where.cycleTaskStatus",
        title: "Where: Cycle Task Status",
        arguments: [task.id]
      };
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

  async getChildren(element?: ProgressItem): Promise<ProgressItem[]> {
    const plan = await this.store.loadPlan();
    if (!plan) {
      return [new ProgressItem("meta", "No source data. Run: Where: Initialize Source File")];
    }

    if (element?.kind === "task" && element.task) {
      return element.task.children.map((task) => new ProgressItem("task", task.title, task));
    }

    const flat = flattenTasks(plan.tasks);
    const done = flat.filter((task) => task.status === "done").length;
    const percent = flat.length === 0 ? 0 : Math.round((done / flat.length) * 100);
    const summary = new ProgressItem("meta", `${plan.title} (${percent}%)`);
    summary.description = `${done}/${flat.length} done`;
    summary.iconPath = new vscode.ThemeIcon("graph");

    const tasks = plan.tasks.map((task) => new ProgressItem("task", task.title, task));
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

  const runInitializeSourceFile = async (): Promise<void> => {
    const source = await store.ensureSourceTemplate();
    const shouldCreateAgents = store.shouldCreateAgentsOnInit();
    const agents = shouldCreateAgents ? await store.ensureAgentsInstructionFile() : undefined;
    const uri = vscode.Uri.file(source.filePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false });
    const messages: string[] = [];
    messages.push(source.created ? "source file created" : "source file already exists");
    if (shouldCreateAgents && agents) {
      messages.push(agents.created ? "AGENTS.md created" : "AGENTS.md already exists");
    } else {
      messages.push("AGENTS.md skipped by config");
    }
    vscode.window.showInformationMessage(`Initialization complete: ${messages.join(", ")}.`);
  };

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("where.projectProgress", provider),
    vscode.commands.registerCommand("where.refreshProgress", () => store.notifyChanged()),
    vscode.commands.registerCommand("where.openWhereSettings", async () => {
      const action = await vscode.window.showQuickPick(
        [
          { label: "Archive Current Plan", command: "where.archiveCurrentPlan" },
          { label: "Query Plan History", command: "where.queryPlanHistory" },
          { label: "Open Source File", command: "where.openSourceFile" },
          { label: "Setup Skill For Current Project", command: "where.setupSkillForProject" },
          { label: "Write Task To Source", command: "where.writeTaskToSource" },
          { label: "Open Progress Dashboard", command: "where.openDashboard" },
          { label: "Validate Source File", command: "where.validateSource" },
          { label: "Refresh Progress", command: "where.refreshProgress" },
          { label: "Configure where.sourceFile", command: "workbench.action.openSettings", args: "where.sourceFile" },
          { label: "Configure where.historyFile", command: "workbench.action.openSettings", args: "where.historyFile" }
        ],
        { placeHolder: "Where Settings" }
      );
      if (!action) {
        return;
      }
      await vscode.commands.executeCommand(action.command, action.args);
    }),
    vscode.commands.registerCommand("where.cycleTaskStatus", async (taskArg?: unknown) => {
      const taskId = extractTaskId(taskArg);
      if (!taskId) {
        return;
      }
      const current = await store.loadPlan();
      const target = current ? flattenTasks(current.tasks).find((task) => task.id === taskId) : undefined;
      if (!target) {
        return;
      }
      const next = cycleStatus(target.status);
      await store.setTaskStatus(taskId, next);
      vscode.window.showInformationMessage(`Task status updated to ${statusLabel(next)}.`);
    }),
    vscode.commands.registerCommand("where.setTaskStatus", async (taskArg?: unknown) => {
      const taskId = extractTaskId(taskArg);
      if (!taskId) {
        return;
      }
      const picked = await vscode.window.showQuickPick(
        [
          { label: "Todo", value: "todo" },
          { label: "In Progress", value: "in_progress" },
          { label: "Blocked", value: "blocked" },
          { label: "Done", value: "done" }
        ],
        { placeHolder: "Set task status" }
      );
      if (!picked) {
        return;
      }
      await store.setTaskStatus(taskId, picked.value as Task["status"]);
      vscode.window.showInformationMessage(`Task status set to ${picked.label}.`);
    }),
    vscode.commands.registerCommand("where.renameTask", async (taskArg?: unknown) => {
      const taskId = extractTaskId(taskArg);
      if (!taskId) {
        return;
      }
      const plan = await store.loadPlan();
      const existing = plan ? flattenTasks(plan.tasks).find((task) => task.id === taskId) : undefined;
      const title = await vscode.window.showInputBox({
        prompt: "Rename task",
        value: existing?.title ?? ""
      });
      if (!title?.trim()) {
        return;
      }
      await store.renameTask(taskId, title);
      vscode.window.showInformationMessage("Task renamed.");
    }),
    vscode.commands.registerCommand("where.deleteTask", async (taskArg?: unknown) => {
      const taskId = extractTaskId(taskArg);
      if (!taskId) {
        return;
      }
      const pick = await vscode.window.showWarningMessage(
        "Delete this task and all its subtasks?",
        { modal: true },
        "Delete"
      );
      if (pick !== "Delete") {
        return;
      }
      await store.deleteTask(taskId);
      vscode.window.showInformationMessage("Task deleted.");
    }),
    vscode.commands.registerCommand("where.promoteTask", async (taskArg?: unknown) => {
      const taskId = extractTaskId(taskArg);
      if (!taskId) {
        return;
      }
      await store.promoteTask(taskId);
      vscode.window.showInformationMessage("Task promoted.");
    }),
    vscode.commands.registerCommand("where.demoteTask", async (taskArg?: unknown) => {
      const taskId = extractTaskId(taskArg);
      if (!taskId) {
        return;
      }
      await store.demoteTask(taskId);
      vscode.window.showInformationMessage("Task demoted.");
    }),
    vscode.commands.registerCommand("where.validateSource", async () => {
      const warnings = await store.validateSource();
      if (warnings.length === 0) {
        vscode.window.showInformationMessage("Source file is valid.");
        return;
      }
      const output = vscode.window.createOutputChannel("Where Validation");
      output.clear();
      output.appendLine("Where source validation warnings:");
      for (const warning of warnings) {
        output.appendLine(`- L${warning.line} [${warning.code}] ${warning.message}`);
      }
      output.show(true);
      vscode.window.showWarningMessage(`Source has ${warnings.length} validation warnings.`);
    }),
    vscode.commands.registerCommand("where.initializeSourceFile", runInitializeSourceFile),
    vscode.commands.registerCommand("where.initSourceFile", runInitializeSourceFile),
    vscode.commands.registerCommand("where.setupSkillForProject", async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showWarningMessage("Open a workspace folder first.");
        return;
      }

      const sourceDir = path.join(context.extensionPath, "skills", "where-skill");
      const destinationDir = path.join(
        workspaceFolder.uri.fsPath,
        ".where",
        "skills",
        "where-skill"
      );
      const setupChoice = await vscode.window.showQuickPick(
        [
          { label: "Codex", value: "codex" as SkillSetupTarget },
          { label: "Claude", value: "claude" as SkillSetupTarget },
          { label: "Both", value: "both" as SkillSetupTarget },
          { label: "Generic", value: "generic" as SkillSetupTarget }
        ],
        { placeHolder: "Select skill setup target" }
      );
      if (!setupChoice) {
        return;
      }
      const setupGuidePaths = resolveSetupGuidePaths(workspaceFolder.uri.fsPath, setupChoice.value);

      try {
        await fs.access(sourceDir);
      } catch {
        vscode.window.showErrorMessage("Bundled where-skill was not found in extension package.");
        return;
      }

      try {
        const destinationExists = await pathExists(destinationDir);
        if (destinationExists) {
          const pick = await vscode.window.showWarningMessage(
            "where-skill already exists in this project. Overwrite it?",
            "Overwrite",
            "Skip"
          );
          if (pick !== "Overwrite") {
            vscode.window.showInformationMessage("Skill setup skipped.");
            return;
          }
          await fs.rm(destinationDir, { recursive: true, force: true });
        }

        await fs.mkdir(path.dirname(destinationDir), { recursive: true });
        await fs.cp(sourceDir, destinationDir, { recursive: true });
        await fs.mkdir(path.join(workspaceFolder.uri.fsPath, ".where"), { recursive: true });
        for (const guide of setupGuidePaths) {
          await fs.writeFile(guide.filePath, buildSkillSetupGuide(guide.type), "utf8");
        }

        const pick = await vscode.window.showInformationMessage(
          "where-skill has been set up for this project.",
          "Open Skill Folder",
          "Open Setup Guide"
        );
        if (pick === "Open Skill Folder") {
          await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(destinationDir));
          return;
        }
        if (pick === "Open Setup Guide") {
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(setupGuidePaths[0].filePath));
          await vscode.window.showTextDocument(doc, { preview: false });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to set up skill.";
        vscode.window.showErrorMessage(`Failed to set up where-skill: ${message}`);
      }
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
    vscode.commands.registerCommand("where.archiveCurrentPlan", async () => {
      try {
        const archived = await store.archiveCurrentPlan();
        const pick = await vscode.window.showInformationMessage(
          `Plan archived: ${archived.filePath}`,
          "Open Archive",
          "Start New Plan"
        );
        if (pick === "Open Archive") {
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(archived.filePath));
          await vscode.window.showTextDocument(doc, { preview: false });
          return;
        }
        if (pick === "Start New Plan") {
          const title = await vscode.window.showInputBox({
            prompt: "New plan title",
            value: "Agent Plan"
          });
          if (!title?.trim()) {
            return;
          }
          await store.resetSourcePlan(title);
          vscode.window.showInformationMessage("Started a new plan in source file.");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to archive plan.";
        vscode.window.showErrorMessage(message);
      }
    }),
    vscode.commands.registerCommand("where.queryPlanHistory", async () => {
      try {
        const entries = await store.listArchivedPlans();
        if (entries.length === 0) {
          vscode.window.showInformationMessage("No archived plans found.");
          return;
        }
        const pick = await vscode.window.showQuickPick(
          entries.map((entry) => ({
            label: entry.title,
            description: formatArchivedAt(entry.archivedAt),
            detail: `Source: ${entry.sourceFile}`,
            entry
          })),
          { placeHolder: "Select an archived plan to preview" }
        );
        if (!pick) {
          return;
        }
        const preview = [
          `# Archived Plan Preview: ${pick.entry.title}`,
          "",
          `- Archived At: ${pick.entry.archivedAt}`,
          `- Source: ${pick.entry.sourceFile}`,
          "",
          "## Snapshot",
          "",
          pick.entry.snapshot,
          ""
        ].join("\n");
        const doc = await vscode.workspace.openTextDocument({
          language: "markdown",
          content: preview
        });
        await vscode.window.showTextDocument(doc, { preview: false });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to query plan history.";
        vscode.window.showErrorMessage(message);
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

  const flat = flattenTasks(plan.tasks);
  const total = flat.length;
  const done = flat.filter((task) => task.status === "done").length;
  const inProgress = flat.filter((task) => task.status === "in_progress").length;
  const blocked = flat.filter((task) => task.status === "blocked").length;
  const todo = flat.filter((task) => task.status === "todo").length;
  const pending = total - done;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const taskHtml = flattenTasksWithDepth(plan.tasks)
    .map(
      ({ task, depth }) => `
      <tr>
        <td style="padding-left: ${8 + depth * 18}px;">${depth > 0 ? "鈫?" : ""}${escapeHtml(task.title)}</td>
        <td><span class="status">${statusLabel(task.status)}</span></td>
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
          --bg: radial-gradient(circle at 20% -10%, rgba(90, 140, 255, 0.18), transparent 32%),
            radial-gradient(circle at 100% 0%, rgba(68, 212, 173, 0.16), transparent 28%),
            linear-gradient(180deg, #f6f8fc 0%, #edf2f8 100%);
          --surface: rgba(255, 255, 255, 0.78);
          --border: rgba(13, 24, 38, 0.1);
          --text: #0f1725;
          --muted: #5d6878;
          --pill-bg: rgba(15, 23, 37, 0.06);
          --shadow: 0 20px 48px rgba(16, 23, 36, 0.08);
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --bg: radial-gradient(circle at 20% -10%, rgba(90, 140, 255, 0.22), transparent 34%),
              radial-gradient(circle at 100% 0%, rgba(68, 212, 173, 0.2), transparent 30%),
              linear-gradient(180deg, #0c1118 0%, #0f1621 100%);
            --surface: rgba(16, 22, 34, 0.72);
            --border: rgba(200, 220, 255, 0.16);
            --text: #e9eef8;
            --muted: #9ea9bc;
            --pill-bg: rgba(233, 238, 248, 0.08);
            --shadow: 0 20px 52px rgba(0, 0, 0, 0.35);
          }
        }
        body {
          font-family: "SF Pro Display", "Avenir Next", "Segoe UI", sans-serif;
          margin: 0;
          padding: 18px;
          background: var(--bg);
          color: var(--text);
        }
        .shell {
          max-width: 1080px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }
        .panel {
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--surface);
          backdrop-filter: blur(18px);
          box-shadow: var(--shadow);
        }
        .hero {
          padding: 18px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: end;
        }
        .title {
          margin: 0;
          font-size: 24px;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }
        .sub {
          margin-top: 8px;
          color: var(--muted);
          font-size: 13px;
          letter-spacing: 0.01em;
        }
        .headline {
          font-size: 28px;
          font-weight: 650;
          letter-spacing: -0.03em;
          text-align: right;
        }
        .badge-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }
        .badge {
          border: 1px solid var(--border);
          background: var(--pill-bg);
          color: var(--muted);
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          letter-spacing: 0.01em;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(120px, 1fr));
          gap: 10px;
          padding: 0 18px 18px;
        }
        .stat {
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px;
          background: rgba(127, 127, 127, 0.05);
        }
        .stat .name {
          color: var(--muted);
          font-size: 12px;
          margin-bottom: 6px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .stat .value {
          font-size: 22px;
          letter-spacing: -0.03em;
          font-weight: 640;
          line-height: 1;
        }
        .table-wrap {
          padding: 8px 18px 18px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          overflow: hidden;
          border-radius: 12px;
        }
        th, td {
          border-bottom: 1px solid var(--border);
          text-align: left;
          padding: 10px 8px;
          font-size: 13px;
        }
        th {
          color: var(--muted);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          font-size: 11px;
        }
        tbody tr:last-child td {
          border-bottom: none;
        }
        .status {
          border: 1px solid var(--border);
          background: var(--pill-bg);
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 11px;
          color: var(--muted);
        }
        @media (max-width: 760px) {
          .hero {
            grid-template-columns: 1fr;
          }
          .headline {
            text-align: left;
          }
          .stats {
            grid-template-columns: repeat(2, minmax(120px, 1fr));
          }
        }
      </style>
    </head>
    <body>
      <main class="shell">
        <section class="panel">
          <div class="hero">
            <div>
              <h2 class="title">${escapeHtml(plan.title)}</h2>
              <div class="sub">${done}/${total} done, ${pending} pending</div>
              <div class="badge-row">
                <span class="badge">Markdown Source</span>
                <span class="badge">Nested Tasks Enabled</span>
              </div>
            </div>
            <div class="headline">${percent}%</div>
          </div>
          <div class="stats">
            <div class="stat"><div class="name">Todo</div><div class="value">${todo}</div></div>
            <div class="stat"><div class="name">In Progress</div><div class="value">${inProgress}</div></div>
            <div class="stat"><div class="name">Blocked</div><div class="value">${blocked}</div></div>
            <div class="stat"><div class="name">Done</div><div class="value">${done}</div></div>
          </div>
        </section>

        <section class="panel table-wrap">
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
        </section>
      </main>
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

function flattenTasks(tasks: Task[]): Task[] {
  const list: Task[] = [];
  const walk = (nodes: Task[]): void => {
    for (const node of nodes) {
      list.push(node);
      if (node.children.length > 0) {
        walk(node.children);
      }
    }
  };
  walk(tasks);
  return list;
}

function flattenTasksWithDepth(tasks: Task[], depth = 0): Array<{ task: Task; depth: number }> {
  const list: Array<{ task: Task; depth: number }> = [];
  for (const task of tasks) {
    list.push({ task, depth });
    if (task.children.length > 0) {
      list.push(...flattenTasksWithDepth(task.children, depth + 1));
    }
  }
  return list;
}

function cycleStatus(status: Task["status"]): Task["status"] {
  switch (status) {
    case "todo":
      return "in_progress";
    case "in_progress":
      return "blocked";
    case "blocked":
      return "done";
    case "done":
    default:
      return "todo";
  }
}

function extractTaskId(taskArg: unknown): string | undefined {
  if (typeof taskArg === "string") {
    return taskArg;
  }
  if (taskArg && typeof taskArg === "object") {
    const maybeTask = taskArg as { task?: Task };
    if (maybeTask.task?.id) {
      return maybeTask.task.id;
    }
  }
  return undefined;
}

function formatArchivedAt(iso: string): string {
  const time = new Date(iso);
  if (Number.isNaN(time.getTime())) {
    return iso;
  }
  return time.toLocaleString();
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

type SkillSetupTarget = "codex" | "claude" | "both" | "generic";
type SkillGuideType = "codex" | "claude" | "generic";

function resolveSetupGuidePaths(
  workspacePath: string,
  target: SkillSetupTarget
): Array<{ filePath: string; type: SkillGuideType }> {
  const base = path.join(workspacePath, ".where");
  if (target === "codex") {
    return [{ filePath: path.join(base, "SKILL_SETUP.codex.md"), type: "codex" }];
  }
  if (target === "claude") {
    return [{ filePath: path.join(base, "SKILL_SETUP.claude.md"), type: "claude" }];
  }
  if (target === "both") {
    return [
      { filePath: path.join(base, "SKILL_SETUP.codex.md"), type: "codex" },
      { filePath: path.join(base, "SKILL_SETUP.claude.md"), type: "claude" }
    ];
  }
  return [{ filePath: path.join(base, "SKILL_SETUP.md"), type: "generic" }];
}

function buildSkillSetupGuide(target: SkillGuideType): string {
  const header = [
    "# Where Skill Setup",
    "",
    "The project-local where-skill has been installed to:",
    "",
    "- `.where/skills/where-skill`",
    "",
    "## Notes",
    "",
    "- Keep `AGENTS.md` and this skill aligned.",
    "- Re-run `Where: Setup Skill For Current Project` after extension upgrades if needed.",
    ""
  ];

  if (target === "codex") {
    return [
      ...header,
      "## For Codex",
      "",
      "- Reference `.where/skills/where-skill` in your project instructions.",
      "- Ask Codex to use `where-skill` for `.where-agent-progress.md` updates.",
      "- Prefer running `scripts/validate_where_plan.ps1` after plan edits.",
      ""
    ].join("\n");
  }

  if (target === "claude") {
    return [
      ...header,
      "## For Claude",
      "",
      "- Add `.where/skills/where-skill` to Claude local project context.",
      "- Trigger it for plan file edits, status transitions, and format recovery.",
      "- Keep task IDs and indentation hierarchy unchanged during edits.",
      ""
    ].join("\n");
  }

  return [
    ...header,
    "## Generic Setup",
    "",
    "- Point your AI agent to `.where/skills/where-skill`.",
    "- Use this skill only when editing `.where-agent-progress.md`.",
    "- Validate plan format after edits before final output.",
    ""
  ].join("\n");
}
