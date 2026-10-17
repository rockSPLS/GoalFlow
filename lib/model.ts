import { z } from "zod";

// Модель данных приложения. Все данные — один JSON-документ в localStorage.

export const TITLE_MAX = 200;

export const STATUSES = ["todo", "in_progress", "paused", "review", "done"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  todo: "К выполнению",
  in_progress: "В работе",
  paused: "На паузе",
  review: "На проверке",
  done: "Готово",
};

// Через сколько напоминать о работающем таймере (и снова — после «Работа продолжается»)
export const REMINDER_MS = 60 * 60 * 1000;
// Повтор звука, пока на напоминание нет ответа
export const REMINDER_REPEAT_MS = 5 * 60 * 1000;
// Самая длинная запись времени — сутки
export const ENTRY_MAX_MINUTES = 24 * 60;

// Вес задачи в story points (шкала Фибоначчи) и расшифровка для подсказок
export const WEIGHTS = [1, 2, 3, 5, 8] as const;
export type Weight = (typeof WEIGHTS)[number];

export const WEIGHT_HINTS: Record<Weight, string> = {
  1: "мелочь (до часа)",
  2: "пара часов",
  3: "около дня",
  5: "2–3 дня",
  8: "неделя и больше (стоит разбить)",
};

// Вес по умолчанию, если он не указан: без весов прогресс равен доле выполненных задач
export const DEFAULT_WEIGHT = 1;

const id = z.string().min(1).max(100);
const title = z.string().trim().min(1).max(TITLE_MAX);
// Дата-время в формате ISO (как у toISOString): кривая дата из файла не должна ронять экран
const isoDate = z.iso.datetime();

export const goalSchema = z.object({
  id,
  title,
  createdAt: isoDate,
});

export const projectSchema = z.object({
  id,
  title,
  // Проект может быть без цели
  goalId: id.nullable(),
  createdAt: isoDate,
});

export const taskSchema = z.object({
  id,
  title,
  status: z.enum(STATUSES),
  weight: z.literal(WEIGHTS).nullable(),
  // Один родитель: проект, цель или никто («Неразобранные»).
  // Если задан проект, goalId пустой — цель берётся из проекта.
  projectId: id.nullable(),
  goalId: id.nullable(),
  // Связанные цели: задача видна у них, но не влияет на их прогресс и время
  relatedGoalIds: z.array(id).max(50).default([]),
  createdAt: isoDate,
  doneAt: isoDate.nullable(),
  // История статусов: какой статус и когда ставился (пишется с момента появления поля)
  statusHistory: z
    .array(z.object({ status: z.enum(STATUSES), at: isoDate }))
    .max(1000)
    .default([]),
});

// Отрезок работы над задачей: от таймера или введённый вручную
export const timeEntrySchema = z.object({
  id,
  taskId: id,
  start: isoDate,
  minutes: z.number().int().min(1).max(ENTRY_MAX_MINUTES),
  source: z.enum(["timer", "manual"]),
});

// Работающий таймер хранит момент старта, а не счётчик — поэтому переживает перезагрузку
export const timerSchema = z.object({
  taskId: id,
  startedAt: isoDate,
  // Когда показать напоминание «таймер всё ещё идёт»
  remindAt: isoDate,
});

export const appDataSchema = z.object({
  version: z.literal(1),
  goals: z.array(goalSchema),
  projects: z.array(projectSchema),
  tasks: z.array(taskSchema),
  // Поля учёта времени появились позже — у старых данных их нет, поэтому значения по умолчанию
  timeEntries: z.array(timeEntrySchema).default([]),
  timer: timerSchema.nullable().default(null),
});

export type Goal = z.infer<typeof goalSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Task = z.infer<typeof taskSchema>;
export type TimeEntry = z.infer<typeof timeEntrySchema>;
export type Timer = z.infer<typeof timerSchema>;
export type AppData = z.infer<typeof appDataSchema>;

// Файл резервной копии: данные плюс метка формата, чтобы не принять чужой JSON
export const backupSchema = z.object({
  format: z.literal("goalflow-backup"),
  exportedAt: isoDate,
  data: appDataSchema,
});

// Куда относится задача
export type Parent =
  | { kind: "inbox" }
  | { kind: "goal"; id: string }
  | { kind: "project"; id: string };

export function emptyData(): AppData {
  return { version: 1, goals: [], projects: [], tasks: [], timeEntries: [], timer: null };
}
