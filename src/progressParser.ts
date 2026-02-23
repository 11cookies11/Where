export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  updatedAt: string;
  sourceLine: number;
  indent: number;
  children: Task[];
}

export interface PlanData {
  title: string;
  updatedAt: string;
  tasks: Task[];
}

export function parseMarkdownPlanText(
  text: string,
  updatedAt: string,
  defaultTitle = "Agent Plan"
): PlanData {
  const lines = text.split(/\r?\n/);
  let title = defaultTitle;
  const tasks: Task[] = [];
  const stack: Array<{ indent: number; task: Task }> = [];
  let counter = 0;

  for (let lineNo = 0; lineNo < lines.length; lineNo += 1) {
    const line = lines[lineNo];
    const titleMatch = line.match(/^#\s*(?:Plan:)?\s*(.+)\s*$/i);
    if (titleMatch && titleMatch[1].trim()) {
      title = titleMatch[1].trim();
      continue;
    }

    const taskMatch = line.match(
      /^([ \t]*)[-*]\s+\[(x|~|!|\s|todo|in_progress|blocked|done)\]\s+(.+)$/i
    );
    if (!taskMatch) {
      continue;
    }
    const indent = measureIndent(taskMatch[1]);
    const marker = taskMatch[2].trim().toLowerCase();
    const taskTitle = taskMatch[3].trim();
    if (!taskTitle) {
      continue;
    }
    counter += 1;
    const task: Task = {
      id: `task-${counter}`,
      title: taskTitle,
      status: normalizeTaskStatus(marker),
      updatedAt,
      sourceLine: lineNo,
      indent,
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

function measureIndent(rawIndent: string): number {
  let width = 0;
  for (const ch of rawIndent) {
    width += ch === "\t" ? 2 : 1;
  }
  return width;
}


export function normalizeTaskStatus(raw: unknown): TaskStatus {
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

export function markerByStatus(status: TaskStatus): " " | "~" | "!" | "x" {
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
