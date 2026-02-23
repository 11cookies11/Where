import { Task, TaskStatus, markerByStatus, parseMarkdownPlanText } from "./progressParser";

interface TaskRef {
  task: Task;
  parent: Task | null;
}

type Direction = "promote" | "demote";

export function setTaskStatusInSource(source: string, taskId: string, status: TaskStatus): string {
  return updateTaskLine(source, taskId, (line, task) => {
    const parsed = parseTaskLine(line);
    if (!parsed) {
      return line;
    }
    return `${parsed.prefix}[${markerByStatus(status)}] ${task.title}`;
  });
}

export function renameTaskInSource(source: string, taskId: string, title: string): string {
  const nextTitle = title.trim();
  if (!nextTitle) {
    throw new Error("Task title cannot be empty.");
  }
  return updateTaskLine(source, taskId, (line) => {
    const parsed = parseTaskLine(line);
    if (!parsed) {
      return line;
    }
    return `${parsed.prefix}[${parsed.marker}] ${nextTitle}`;
  });
}

export function deleteTaskInSource(source: string, taskId: string): string {
  const lines = splitLines(source);
  const plan = parseMarkdownPlanText(source, new Date().toISOString());
  const refs = flattenWithParents(plan.tasks);
  const targetRef = refs.find((ref) => ref.task.id === taskId);
  if (!targetRef) {
    throw new Error("Task not found.");
  }
  const start = targetRef.task.sourceLine;
  const end = findTaskBlockEndLine(lines, start, targetRef.task.indent);
  lines.splice(start, end - start);
  return normalizeLines(lines);
}

export function moveTaskIndentInSource(
  source: string,
  taskId: string,
  direction: Direction
): string {
  const lines = splitLines(source);
  const plan = parseMarkdownPlanText(source, new Date().toISOString());
  const refs = flattenWithParents(plan.tasks);
  const targetRef = refs.find((ref) => ref.task.id === taskId);
  if (!targetRef) {
    throw new Error("Task not found.");
  }

  const target = targetRef.task;
  const start = target.sourceLine;
  const end = findTaskBlockEndLine(lines, start, target.indent);
  const block = lines.slice(start, end);

  if (direction === "promote") {
    if (target.indent < 2) {
      throw new Error("Task is already top-level.");
    }
    for (let i = 0; i < block.length; i += 1) {
      block[i] = outdentLine(block[i], 2);
    }
  } else {
    const previousSibling = findPreviousSibling(targetRef, refs);
    if (!previousSibling) {
      throw new Error("Cannot demote without a previous sibling.");
    }
    for (let i = 0; i < block.length; i += 1) {
      block[i] = indentLine(block[i], 2);
    }
  }

  lines.splice(start, end - start, ...block);
  return normalizeLines(lines);
}

function updateTaskLine(
  source: string,
  taskId: string,
  updater: (line: string, task: Task) => string
): string {
  const lines = splitLines(source);
  const plan = parseMarkdownPlanText(source, new Date().toISOString());
  const refs = flattenWithParents(plan.tasks);
  const targetRef = refs.find((ref) => ref.task.id === taskId);
  if (!targetRef) {
    throw new Error("Task not found.");
  }
  const lineNo = targetRef.task.sourceLine;
  lines[lineNo] = updater(lines[lineNo], targetRef.task);
  return normalizeLines(lines);
}

function splitLines(source: string): string[] {
  return source.split(/\r?\n/);
}

function normalizeLines(lines: string[]): string {
  const text = lines.join("\n").replace(/\n+$/g, "");
  return `${text}\n`;
}

function parseTaskLine(line: string): { prefix: string; marker: string } | null {
  const match = line.match(/^([ \t]*[-*]\s+)\[(x|~|!|\s|todo|in_progress|blocked|done)\]\s+.*$/i);
  if (!match) {
    return null;
  }
  return { prefix: match[1], marker: match[2] };
}

function flattenWithParents(tasks: Task[], parent: Task | null = null): TaskRef[] {
  const list: TaskRef[] = [];
  for (const task of tasks) {
    list.push({ task, parent });
    if (task.children.length > 0) {
      list.push(...flattenWithParents(task.children, task));
    }
  }
  return list;
}

function findTaskBlockEndLine(lines: string[], startLine: number, indent: number): number {
  let index = startLine + 1;
  while (index < lines.length) {
    const match = lines[index].match(/^([ \t]*)[-*]\s+\[/);
    if (match) {
      const nextIndent = measureIndent(match[1]);
      if (nextIndent <= indent) {
        break;
      }
    }
    index += 1;
  }
  return index;
}

function measureIndent(rawIndent: string): number {
  let width = 0;
  for (const ch of rawIndent) {
    width += ch === "\t" ? 2 : 1;
  }
  return width;
}

function findPreviousSibling(target: TaskRef, refs: TaskRef[]): TaskRef | null {
  const siblings = refs.filter(
    (ref) => ref.parent?.id === target.parent?.id && ref.task.id !== target.task.id
  );
  const previous = siblings
    .filter((ref) => ref.task.sourceLine < target.task.sourceLine)
    .sort((a, b) => b.task.sourceLine - a.task.sourceLine)[0];
  return previous ?? null;
}

function indentLine(line: string, count: number): string {
  return `${" ".repeat(count)}${line}`;
}

function outdentLine(line: string, count: number): string {
  let next = line;
  let removed = 0;
  while (removed < count && next.startsWith(" ")) {
    next = next.slice(1);
    removed += 1;
  }
  return next;
}
