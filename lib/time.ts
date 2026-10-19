import type { AppData, TimeEntry } from "./model";

// Подсчёт и вывод потраченного времени

// «2 ч 15 мин», «45 мин», «3 ч»
export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} мин`;
  if (minutes === 0) return `${hours} ч`;
  return `${hours} ч ${minutes} мин`;
}

// Идущий таймер: «0:42:13»
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function sumMinutes(entries: TimeEntry[]): number {
  return entries.reduce((sum, e) => sum + e.minutes, 0);
}

// Время по набору задач
export function minutesForTasks(data: AppData, taskIds: Set<string>): number {
  return sumMinutes(data.timeEntries.filter((e) => taskIds.has(e.taskId)));
}

// Начало дня по местному времени
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Начало недели — понедельник
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  const shift = (day.getDay() + 6) % 7;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - shift);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// Записи, начатые в промежутке [from, to)
export function entriesBetween(entries: TimeEntry[], from: Date, to: Date): TimeEntry[] {
  const a = from.getTime();
  const b = to.getTime();
  return entries.filter((e) => {
    const t = new Date(e.start).getTime();
    return t >= a && t < b;
  });
}

// Цель, к которой относится задача (через проект или напрямую)
export function goalIdOfTask(data: AppData, taskId: string): string | null {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return null;
  if (task.projectId !== null) return data.projects.find((p) => p.id === task.projectId)?.goalId ?? null;
  return task.goalId;
}

// Значение для <input type="date"> по местному времени: «2026-10-17»
export function toDateInputValue(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

const dayFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const weekdayFormat = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short" });
const timeFormat = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

export function formatDay(date: Date): string {
  return dayFormat.format(date);
}

export function formatWeekday(date: Date): string {
  return weekdayFormat.format(date);
}

export function formatTime(date: Date): string {
  return timeFormat.format(date);
}

const monthFormat = new Intl.DateTimeFormat("ru-RU", { month: "long" });

// «Сентябрь 2026»
export function formatMonth(date: Date): string {
  const month = monthFormat.format(date);
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${date.getFullYear()}`;
}
