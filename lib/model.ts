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

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
};

export const DESCRIPTION_MAX = 5000;
export const TAG_MAX = 30;
// Не больше 5 тегов у задачи — иначе теги перестают выделять задачи. Схема пропускает до 20:
// у задач из старых данных или файла копии тегов может быть больше, и данные из-за этого не должны отвергаться
export const TAGS_PER_TASK = 5;
export const TAGS_STORED_MAX = 20;
export const RELATED_MAX = 50;
export const VIEW_NAME_MAX = 60;
export const VIEWS_MAX = 50;
export const TAG_LIBRARY_MAX = 1000;

const id = z.string().min(1).max(100);
const title = z.string().trim().min(1).max(TITLE_MAX);
// Дата-время в формате ISO (как у toISOString): кривая дата из файла не должна ронять экран
const isoDate = z.iso.datetime();
// Дата без времени: «2026-10-22»
export const dayDate = z.iso.date();
const tag = z.string().trim().min(1).max(TAG_MAX);

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
  // Поля, появившиеся позже, — со значениями по умолчанию, чтобы старые данные загружались.
  // Старое поле relatedGoalIds схема просто отбрасывает (лишние ключи zod не пропускает).
  description: z.string().max(DESCRIPTION_MAX).default(""),
  // Дедлайн — только дата
  deadline: dayDate.nullable().default(null),
  priority: z.enum(PRIORITIES).nullable().default(null),
  tags: z.array(tag).max(TAGS_STORED_MAX).default([]),
  // Связанные задачи: связь двусторонняя (хранится у обеих задач), на прогресс и время не влияет
  relatedTaskIds: z.array(id).max(RELATED_MAX).default([]),
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

export const DEADLINE_FILTERS = ["overdue", "today", "week"] as const;

// Условия фильтра задач; null / false — условие не задано
export const taskFilterSchema = z.object({
  status: z.enum(STATUSES).nullable().default(null),
  // "none" — задачи без приоритета
  priority: z.enum([...PRIORITIES, "none"]).nullable().default(null),
  tag: tag.nullable().default(null),
  deadline: z.enum(DEADLINE_FILTERS).nullable().default(null),
  noGoal: z.boolean().default(false),
  over4h: z.boolean().default(false),
});

// Сохранённый вид — сочетание условий под своим именем
export const savedViewSchema = z.object({
  id,
  name: z.string().trim().min(1).max(VIEW_NAME_MAX),
  filter: taskFilterSchema,
});

export const appDataSchema = z.object({
  version: z.literal(1),
  goals: z.array(goalSchema),
  projects: z.array(projectSchema),
  tasks: z.array(taskSchema),
  // Поля учёта времени появились позже — у старых данных их нет, поэтому значения по умолчанию
  timeEntries: z.array(timeEntrySchema).default([]),
  timer: timerSchema.nullable().default(null),
  views: z.array(savedViewSchema).max(VIEWS_MAX).default([]),
  // Справочник тегов: все теги, которые когда-либо ставили задачам (пока их не удалили из справочника)
  tags: z.array(tag).max(TAG_LIBRARY_MAX).default([]),
});

export type TaskFilter = z.infer<typeof taskFilterSchema>;
export type SavedView = z.infer<typeof savedViewSchema>;
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
  return { version: 1, goals: [], projects: [], tasks: [], timeEntries: [], timer: null, views: [], tags: [] };
}
