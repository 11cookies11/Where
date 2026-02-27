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

export interface ParseWarning {
  line: number;
  code: "invalid-task-line" | "tab-indentation" | "odd-indentation" | "duplicate-task-title";
  message: string;
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
    const { title: taskTitle, id: stableId } = splitTaskTitleAndId(taskMatch[3]);
    if (!taskTitle) {
      continue;
    }
    counter += 1;
    const task: Task = {
      id: stableId ?? `task-${counter}`,
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

export function analyzeMarkdownPlanText(text: string): ParseWarning[] {
  const warnings: ParseWarning[] = [];
  const lines = text.split(/\r?\n/);
  const seenTitles = new Map<string, number>();

  for (let lineNo = 0; lineNo < lines.length; lineNo += 1) {
    const line = lines[lineNo];
    if (!line.trim()) {
      continue;
    }

    const rawTask = line.match(/^([ \t]*)[-*]\s+\[(.+?)\]\s*(.*)$/i);
    if (rawTask) {
      const rawIndent = rawTask[1];
      const markerRaw = rawTask[2].toLowerCase();
      const marker = markerRaw.trim();
      const { title } = splitTaskTitleAndId(rawTask[3]);

      if (rawIndent.includes("\t")) {
        warnings.push({
          line: lineNo + 1,
          code: "tab-indentation",
          message: "Tab indentation detected. Use spaces for stable hierarchy parsing."
        });
      }
      const indent = measureIndent(rawIndent);
      if (indent % 2 !== 0) {
        warnings.push({
          line: lineNo + 1,
          code: "odd-indentation",
          message: "Indentation is not a multiple of 2 spaces."
        });
      }

      const isMarkerValid =
        markerRaw === " " || ["x", "~", "!", "todo", "in_progress", "blocked", "done"].includes(marker);
      if (!isMarkerValid || !title) {
        warnings.push({
          line: lineNo + 1,
          code: "invalid-task-line",
          message: "Task line format should be: - [ ] title / - [~] title / - [!] title / - [x] title."
        });
        continue;
      }

      const normalized = title.toLowerCase();
      if (seenTitles.has(normalized)) {
        const firstLine = seenTitles.get(normalized);
        warnings.push({
          line: lineNo + 1,
          code: "duplicate-task-title",
          message: `Duplicate task title (first seen at line ${firstLine}).`
        });
      } else {
        seenTitles.set(normalized, lineNo + 1);
      }
      continue;
    }

    if (line.trimStart().startsWith("-") || line.trimStart().startsWith("*")) {
      warnings.push({
        line: lineNo + 1,
        code: "invalid-task-line",
        message: "Bullet line detected but not in Where task format."
      });
    }
  }

  return warnings;
}

function splitTaskTitleAndId(raw: string): { title: string; id?: string } {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(.*?)\s*<!--\s*where:id:([a-z0-9_-]+)\s*-->\s*$/i);
  if (!match) {
    return { title: trimmed };
  }
  const title = match[1].trim();
  const id = match[2].trim();
  return id ? { title, id } : { title };
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
