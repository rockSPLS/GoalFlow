import { z } from "zod";

// Модель данных приложения. Все данные — один JSON-документ в localStorage.

export const TITLE_MAX = 200;

export const STATUSES = ["todo", "in_progress", "review", "done"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  todo: "К выполнению",
  in_progress: "В работе",
  review: "На проверке",
  done: "Готово",
};

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
const isoDate = z.string().max(40);

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
  // Один родитель: проект, цель или никто («Входящие»).
  // Если задан проект, goalId пустой — цель берётся из проекта.
  projectId: id.nullable(),
  goalId: id.nullable(),
  // Связанные цели: задача видна у них, но не влияет на их прогресс и время
  relatedGoalIds: z.array(id).max(50).default([]),
  createdAt: isoDate,
  doneAt: isoDate.nullable(),
});

export const appDataSchema = z.object({
  version: z.literal(1),
  goals: z.array(goalSchema),
  projects: z.array(projectSchema),
  tasks: z.array(taskSchema),
});

export type Goal = z.infer<typeof goalSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Task = z.infer<typeof taskSchema>;
export type AppData = z.infer<typeof appDataSchema>;

// Куда относится задача
export type Parent =
  | { kind: "inbox" }
  | { kind: "goal"; id: string }
  | { kind: "project"; id: string };

export function emptyData(): AppData {
  return { version: 1, goals: [], projects: [], tasks: [] };
}
