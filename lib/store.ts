"use client";

import { useSyncExternalStore } from "react";
import {
  appDataSchema,
  emptyData,
  TITLE_MAX,
  type AppData,
  type Goal,
  type Parent,
  type Project,
  type Status,
  type Task,
  type Weight,
} from "./model";

// Хранилище: один JSON-документ в localStorage + подписка для React (useSyncExternalStore).
// На сервере данных нет — компоненты получают null и показывают загрузку.

const STORAGE_KEY = "goalflow:data";

const BACKUP_PREFIX = `${STORAGE_KEY}:broken:`;

export type Snapshot = {
  data: AppData;
  // Сообщение для пользователя о проблеме с хранилищем (повреждённые данные, нет места)
  notice: string | null;
  // Запись запрещена: повреждённые данные не удалось скопировать, и сохранение их бы затёрло
  locked: boolean;
};

let snapshot: Snapshot | null = null;
const listeners = new Set<() => void>();

// Ищет уже сделанную копию с тем же содержимым, чтобы не плодить копии при каждой загрузке
function findBackup(raw: string): string | null {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(BACKUP_PREFIX) && localStorage.getItem(key) === raw) return key;
  }
  return null;
}

function readStorage(): Snapshot {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return {
      data: emptyData(),
      notice: "Хранилище браузера недоступно — данные не сохранятся после перезагрузки.",
      locked: false,
    };
  }
  if (raw === null) return { data: emptyData(), notice: null, locked: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  const result = appDataSchema.safeParse(parsed);
  if (result.success) return { data: normalize(result.data), notice: null, locked: false };

  // Повреждённые данные не затираем: сначала сохраняем копию под отдельным ключом
  let backupKey = findBackup(raw);
  if (backupKey === null) {
    const key = `${BACKUP_PREFIX}${Date.now()}`;
    try {
      localStorage.setItem(key, raw);
      backupKey = key;
    } catch {
      // нет места даже для копии
    }
  }
  if (backupKey === null) {
    return {
      data: emptyData(),
      notice:
        "Сохранённые данные повреждены, а сделать их копию не удалось: в хранилище браузера нет места. Чтобы не затереть старые данные, изменения сейчас не сохраняются.",
      locked: true,
    };
  }
  return {
    data: emptyData(),
    notice: `Сохранённые данные повреждены. Их копия лежит в хранилище браузера под ключом «${backupKey}», а приложение начато с чистого листа.`,
    locked: false,
  };
}

// Чинит ссылки на несуществующие цели и проекты (например, после правки данных вручную),
// чтобы задача не «потерялась»: без живого родителя она попадает во «Входящие»
function normalize(data: AppData): AppData {
  const goalIds = new Set(data.goals.map((g) => g.id));
  const projects = data.projects.map((p) =>
    p.goalId !== null && !goalIds.has(p.goalId) ? { ...p, goalId: null } : p,
  );
  const projectIds = new Set(projects.map((p) => p.id));
  const tasks = data.tasks.map((t) => {
    const projectId = t.projectId !== null && projectIds.has(t.projectId) ? t.projectId : null;
    const goalId = projectId === null && t.goalId !== null && goalIds.has(t.goalId) ? t.goalId : null;
    return { ...t, projectId, goalId, relatedGoalIds: t.relatedGoalIds.filter((g) => goalIds.has(g)) };
  });
  return { ...data, projects, tasks };
}

function getSnapshot(): Snapshot {
  if (snapshot === null) snapshot = readStorage();
  return snapshot;
}

function getServerSnapshot(): Snapshot | null {
  return null;
}

function emit() {
  for (const listener of listeners) listener();
}

// Изменения из другой вкладки с этим же приложением
function onStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) return;
  snapshot = readStorage();
  emit();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function useStore(): Snapshot | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Применяет изменение к данным и сохраняет результат
function update(change: (data: AppData) => AppData) {
  const current = getSnapshot();
  const next = change(current.data);
  // Прежнее сообщение не теряется после первого же действия — его скрывает только пользователь
  let notice = current.notice;
  if (!current.locked) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      notice = "Не удалось сохранить изменения: хранилище браузера переполнено или недоступно.";
    }
  }
  snapshot = { data: next, notice, locked: current.locked };
  emit();
}

export function dismissNotice() {
  const current = getSnapshot();
  snapshot = { ...current, notice: null };
  emit();
}

function newId() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function cleanTitle(title: string) {
  return title.trim().slice(0, TITLE_MAX);
}

// Поля задачи для выбранного родителя (у задачи ровно один родитель)
function parentFields(parent: Parent): Pick<Task, "projectId" | "goalId"> {
  if (parent.kind === "project") return { projectId: parent.id, goalId: null };
  if (parent.kind === "goal") return { projectId: null, goalId: parent.id };
  return { projectId: null, goalId: null };
}

// --- Цели ---

export function addGoal(title: string): string | null {
  const clean = cleanTitle(title);
  if (!clean) return null;
  const goal: Goal = { id: newId(), title: clean, createdAt: now() };
  update((d) => ({ ...d, goals: [...d.goals, goal] }));
  return goal.id;
}

export function renameGoal(id: string, title: string) {
  const clean = cleanTitle(title);
  if (!clean) return;
  update((d) => ({ ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, title: clean } : g)) }));
}

// Удаление цели не удаляет её проекты и задачи: они остаются без цели
export function deleteGoal(id: string) {
  update((d) => ({
    ...d,
    goals: d.goals.filter((g) => g.id !== id),
    projects: d.projects.map((p) => (p.goalId === id ? { ...p, goalId: null } : p)),
    tasks: d.tasks.map((t) => ({
      ...t,
      goalId: t.goalId === id ? null : t.goalId,
      relatedGoalIds: t.relatedGoalIds.filter((g) => g !== id),
    })),
  }));
}

// --- Проекты ---

export function addProject(title: string, goalId: string | null): string | null {
  const clean = cleanTitle(title);
  if (!clean) return null;
  const project: Project = { id: newId(), title: clean, goalId, createdAt: now() };
  update((d) => ({ ...d, projects: [...d.projects, project] }));
  return project.id;
}

export function renameProject(id: string, title: string) {
  const clean = cleanTitle(title);
  if (!clean) return;
  update((d) => ({ ...d, projects: d.projects.map((p) => (p.id === id ? { ...p, title: clean } : p)) }));
}

export function setProjectGoal(id: string, goalId: string | null) {
  update((d) => ({ ...d, projects: d.projects.map((p) => (p.id === id ? { ...p, goalId } : p)) }));
}

// Удаление проекта не удаляет задачи: они переходят к цели проекта или во «Входящие»
export function deleteProject(id: string) {
  update((d) => {
    const project = d.projects.find((p) => p.id === id);
    const goalId = project?.goalId ?? null;
    return {
      ...d,
      projects: d.projects.filter((p) => p.id !== id),
      tasks: d.tasks.map((t) => (t.projectId === id ? { ...t, projectId: null, goalId } : t)),
    };
  });
}

// --- Задачи ---

export function addTask(title: string, parent: Parent): string | null {
  const clean = cleanTitle(title);
  if (!clean) return null;
  const task: Task = {
    id: newId(),
    title: clean,
    status: "todo",
    weight: null,
    ...parentFields(parent),
    relatedGoalIds: [],
    createdAt: now(),
    doneAt: null,
  };
  update((d) => ({ ...d, tasks: [...d.tasks, task] }));
  return task.id;
}

function patchTask(id: string, patch: (t: Task) => Task) {
  update((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? patch(t) : t)) }));
}

export function renameTask(id: string, title: string) {
  const clean = cleanTitle(title);
  if (!clean) return;
  patchTask(id, (t) => ({ ...t, title: clean }));
}

export function setTaskStatus(id: string, status: Status) {
  patchTask(id, (t) => ({
    ...t,
    status,
    // Дата выполнения ставится при переходе в «Готово» и сбрасывается при выходе из него
    doneAt: status === "done" ? (t.status === "done" ? t.doneAt : now()) : null,
  }));
}

export function setTaskWeight(id: string, weight: Weight | null) {
  patchTask(id, (t) => ({ ...t, weight }));
}

export function moveTask(id: string, parent: Parent) {
  patchTask(id, (t) => ({ ...t, ...parentFields(parent) }));
}

export function deleteTask(id: string) {
  update((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
}
