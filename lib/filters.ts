import { taskFilterSchema, type AppData, type Task, type TaskFilter } from "./model";
import { startOfWeek, addDays, toDateInputValue } from "./time";

// Фильтры задач, готовые виды, состояние дедлайна, цвет тега

export const EMPTY_FILTER: TaskFilter = taskFilterSchema.parse({});

// «Застряли» — больше 4 часов затрат времени
export const STUCK_MINUTES = 4 * 60;

export type ReadyView = { id: string; name: string; filter: TaskFilter };

export const READY_VIEWS: ReadyView[] = [
  { id: "ready:no-goal", name: "Без цели", filter: { ...EMPTY_FILTER, noGoal: true } },
  { id: "ready:stuck", name: "Застряли (больше 4 ч)", filter: { ...EMPTY_FILTER, over4h: true } },
  { id: "ready:week", name: "Дедлайн на этой неделе", filter: { ...EMPTY_FILTER, deadline: "week" } },
  { id: "ready:overdue", name: "Просроченные", filter: { ...EMPTY_FILTER, deadline: "overdue" } },
];

export function sameFilter(a: TaskFilter, b: TaskFilter): boolean {
  return (
    a.status === b.status &&
    a.priority === b.priority &&
    a.tag === b.tag &&
    a.deadline === b.deadline &&
    a.noGoal === b.noGoal &&
    a.over4h === b.over4h
  );
}

export function isEmptyFilter(f: TaskFilter): boolean {
  return sameFilter(f, EMPTY_FILTER);
}

// Сегодня — дата «ГГГГ-ММ-ДД» по местному времени
export function todayKey(): string {
  return toDateInputValue(new Date());
}

// Просрочена ли задача: дедлайн прошёл, а задача не выполнена
export function deadlineState(task: Task, today: string): "overdue" | "today" | null {
  if (task.deadline === null || task.status === "done") return null;
  if (task.deadline < today) return "overdue";
  if (task.deadline === today) return "today";
  return null;
}

const sameTag = (a: string, b: string) => a.toLocaleLowerCase("ru") === b.toLocaleLowerCase("ru");

// Задачи, подходящие под все заданные условия
export function filterTasks(data: AppData, tasks: Task[], f: TaskFilter, today: string): Task[] {
  // «Эта неделя» — от сегодня до воскресенья: прошедшие дни недели уже попадают в «Просрочено»
  const weekEnd = toDateInputValue(addDays(startOfWeek(new Date(`${today}T12:00:00`)), 6));
  // Цели проектов и минуты по задачам считаются один раз, а не для каждой задачи заново
  const projectGoal = new Map(data.projects.map((p) => [p.id, p.goalId]));
  const minutes = new Map<string, number>();
  if (f.over4h) for (const e of data.timeEntries) minutes.set(e.taskId, (minutes.get(e.taskId) ?? 0) + e.minutes);
  return tasks.filter((t) => {
    if (f.status !== null && t.status !== f.status) return false;
    if (f.priority === "none" ? t.priority !== null : f.priority !== null && t.priority !== f.priority) return false;
    if (f.tag !== null && !t.tags.some((tg) => sameTag(tg, f.tag ?? ""))) return false;
    if (f.deadline === "overdue" && deadlineState(t, today) !== "overdue") return false;
    if (f.deadline === "today" && t.deadline !== today) return false;
    if (f.deadline === "week" && (t.deadline === null || t.deadline < today || t.deadline > weekEnd)) return false;
    if (f.noGoal && (t.projectId !== null ? (projectGoal.get(t.projectId) ?? null) : t.goalId) !== null) return false;
    if (f.over4h && (minutes.get(t.id) ?? 0) <= STUCK_MINUTES) return false;
    return true;
  });
}

// Все теги — справочник и теги задач (каждый один раз), по алфавиту
export function allTags(data: AppData): string[] {
  const seen = new Map<string, string>();
  for (const tg of [...data.tags, ...data.tasks.flatMap((t) => t.tags)]) if (!seen.has(tg.toLocaleLowerCase("ru"))) seen.set(tg.toLocaleLowerCase("ru"), tg);
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "ru"));
}

// Цвет тега назначается автоматически: один и тот же тег всегда одного цвета
const TAG_COLORS = [
  "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  "bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
];

export function tagColor(tag: string): string {
  let hash = 0;
  for (const ch of tag.toLocaleLowerCase("ru")) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) % 100000;
  return TAG_COLORS[hash % TAG_COLORS.length];
}
