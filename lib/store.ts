"use client";

import { useSyncExternalStore } from "react";
import {
  appDataSchema,
  dayDate,
  DESCRIPTION_MAX,
  emptyData,
  ENTRY_MAX_MINUTES,
  RELATED_MAX,
  REMINDER_MS,
  TAG_LIBRARY_MAX,
  TAG_MAX,
  TAGS_PER_TASK,
  TITLE_MAX,
  VIEW_NAME_MAX,
  VIEWS_MAX,
  type AppData,
  type Goal,
  type Parent,
  type Priority,
  type Project,
  type SavedView,
  type Status,
  type Task,
  type TaskFilter,
  type TimeEntry,
  type Weight,
} from "./model";

// Хранилище: один JSON-документ в localStorage + подписка для React (useSyncExternalStore).
// На сервере данных нет — компоненты получают null и показывают загрузку.

const STORAGE_KEY = "goalflow:data";

const BACKUP_PREFIX = `${STORAGE_KEY}:broken:`;
// Копия данных перед последним восстановлением из файла
const IMPORT_BACKUP_KEY = `${STORAGE_KEY}:before-import`;

// Сообщение после восстановления — к нему интерфейс добавляет кнопки «скачать прежние / отменить»
export const IMPORT_NOTICE =
  "Данные восстановлены из файла. Если выбран не тот файл, прежние данные можно скачать или вернуть.";

// Копии в хранилище браузера: по одной каждого вида, новая заменяет старую.
// Даты — когда копия сохранена (у копий старого формата дата неизвестна — пустая строка).
export type Copies = {
  beforeImport: string | null;
  broken: { key: string; at: string } | null;
};

export type Snapshot = {
  data: AppData;
  // Сообщение для пользователя о проблеме с хранилищем (повреждённые данные, нет места)
  notice: string | null;
  // Запись запрещена: повреждённые данные не удалось скопировать, и сохранение их бы затёрло
  locked: boolean;
  // Ключ хранилища с повреждёнными данными для кнопки в сообщении (или null)
  brokenKey: string | null;
  copies: Copies;
};

// Повреждённые данные скачиваются как есть — восстановить их приложение не может,
// но файл можно поправить вручную или показать специалисту
export function brokenDataRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function brokenKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(BACKUP_PREFIX)) keys.push(key);
  }
  return keys;
}

// Время сохранения повреждённой копии записано в её ключе
function brokenAt(key: string): string {
  const ms = Number(key.slice(BACKUP_PREFIX.length));
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : "";
}

function readCopies(): Copies {
  try {
    let beforeImport: string | null = null;
    const raw = localStorage.getItem(IMPORT_BACKUP_KEY);
    if (raw !== null) {
      beforeImport = "";
      try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && "savedAt" in parsed && typeof parsed.savedAt === "string") {
          beforeImport = parsed.savedAt;
        }
      } catch {
        // дата неизвестна, копия всё равно показывается
      }
    }
    // Если повреждённых копий несколько (старые версии приложения), показываем самую новую
    const newest = brokenKeys().sort().pop();
    return { beforeImport, broken: newest ? { key: newest, at: brokenAt(newest) } : null };
  } catch {
    return { beforeImport: null, broken: null };
  }
}

function loadSnapshot(): Snapshot {
  return { ...readStorage(), copies: readCopies() };
}

// Пересчитать список копий после изменений в хранилище. Если копия, о которой говорит сообщение,
// исчезла (например, её удалили в другой вкладке), убираем и сообщение — его кнопки больше не работают.
function refreshCopies() {
  const current = getSnapshot();
  const copies = readCopies();
  let { notice, brokenKey } = current;
  if (brokenKey?.startsWith(BACKUP_PREFIX) && brokenDataRaw(brokenKey) === null) {
    brokenKey = null;
    notice = null;
  }
  if (notice === IMPORT_NOTICE && copies.beforeImport === null) notice = null;
  snapshot = { ...current, notice, brokenKey, copies };
  emit();
}

let snapshot: Snapshot | null = null;
const listeners = new Set<() => void>();

// Ищет уже сделанную копию с тем же содержимым, чтобы не плодить копии при каждой загрузке
function findBackup(raw: string): string | null {
  return brokenKeys().find((key) => localStorage.getItem(key) === raw) ?? null;
}

function readStorage(): Omit<Snapshot, "copies"> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return {
      data: emptyData(),
      notice: "Хранилище браузера недоступно — данные не сохранятся после перезагрузки.",
      locked: false,
      brokenKey: null,
    };
  }
  if (raw === null) return { data: emptyData(), notice: null, locked: false, brokenKey: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  const result = appDataSchema.safeParse(parsed);
  if (result.success) return { data: normalize(result.data), notice: null, locked: false, brokenKey: null };

  // Повреждённые данные не затираем: сначала сохраняем копию под отдельным ключом
  let backupKey = findBackup(raw);
  if (backupKey === null) {
    const key = `${BACKUP_PREFIX}${Date.now()}`;
    // Храним одну повреждённую копию: новая заменяет старые, чтобы не занимать место.
    // Если места не хватило — убираем старые копии и пробуем ещё раз.
    for (let attempt = 0; attempt < 2 && backupKey === null; attempt++) {
      try {
        localStorage.setItem(key, raw);
        backupKey = key;
      } catch {
        if (attempt === 0) for (const old of brokenKeys()) localStorage.removeItem(old);
      }
    }
    if (backupKey !== null) for (const old of brokenKeys()) if (old !== key) localStorage.removeItem(old);
  }
  if (backupKey === null) {
    return {
      data: emptyData(),
      notice:
        "Сохранённые данные повреждены, а сделать их копию не удалось: в хранилище браузера нет места. Чтобы не затереть старые данные, изменения сейчас не сохраняются. Повреждённые данные можно скачать файлом.",
      locked: true,
      // Копии нет — скачиваем прямо из основного ключа, там они и лежат
      brokenKey: STORAGE_KEY,
    };
  }
  return {
    data: emptyData(),
    notice: "Сохранённые данные повреждены, поэтому приложение начато с чистого листа. Их копия сохранена — её можно скачать файлом.",
    locked: false,
    brokenKey: backupKey,
  };
}

// Чинит ссылки на несуществующие цели и проекты (например, после правки данных вручную),
// чтобы задача не «потерялась»: без живого родителя она попадает в «Неразобранные»
function normalize(data: AppData): AppData {
  const goalIds = new Set(data.goals.map((g) => g.id));
  const projects = data.projects.map((p) =>
    p.goalId !== null && !goalIds.has(p.goalId) ? { ...p, goalId: null } : p,
  );
  const projectIds = new Set(projects.map((p) => p.id));
  const taskIds = new Set(data.tasks.map((t) => t.id));
  const related = symmetricLinks(data.tasks, taskIds);
  const tasks = data.tasks.map((t) => {
    const projectId = t.projectId !== null && projectIds.has(t.projectId) ? t.projectId : null;
    const goalId = projectId === null && t.goalId !== null && goalIds.has(t.goalId) ? t.goalId : null;
    // Повторы тегов (например, из поправленного вручную файла) убираются без учёта регистра
    const tags = t.tags.filter(
      (tg, i) => t.tags.findIndex((other) => other.toLocaleLowerCase("ru") === tg.toLocaleLowerCase("ru")) === i,
    );
    return { ...t, projectId, goalId, tags, relatedTaskIds: related.get(t.id) ?? [] };
  });
  // Записи времени и таймер удалённой задачи не нужны
  const timeEntries = data.timeEntries.filter((e) => taskIds.has(e.taskId));
  const timer = data.timer !== null && taskIds.has(data.timer.taskId) ? data.timer : null;
  return { ...data, projects, tasks, timeEntries, timer, tags: tagLibrary(data.tags, tasks) };
}

const tagKey = (tag: string) => tag.toLocaleLowerCase("ru");

// Справочник тегов: прежний список плюс теги задач (у старых данных справочника нет — он собирается из задач).
// Повторы без учёта регистра убираются, первым остаётся уже записанное написание.
function tagLibrary(library: string[], tasks: Task[]): string[] {
  const seen = new Map<string, string>();
  for (const tg of [...library, ...tasks.flatMap((t) => t.tags)]) if (!seen.has(tagKey(tg))) seen.set(tagKey(tg), tg);
  return [...seen.values()].slice(0, TAG_LIBRARY_MAX);
}

// Связи задач делаются двусторонними: связь, записанная только у одной задачи, дописывается второй;
// ссылки на удалённые задачи и на саму себя отбрасываются. Если у задачи связей больше предела,
// лишние убираются с обеих сторон — иначе следующая загрузка не прошла бы проверку схемой.
function symmetricLinks(tasks: Task[], taskIds: Set<string>): Map<string, string[]> {
  const union = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!union.has(a)) union.set(a, new Set());
    union.get(a)?.add(b);
  };
  for (const t of tasks) {
    for (const other of t.relatedTaskIds) {
      if (other === t.id || !taskIds.has(other)) continue;
      link(t.id, other);
      link(other, t.id);
    }
  }
  const trimmed = new Map([...union].map(([id, set]) => [id, [...set].slice(0, RELATED_MAX)]));
  const result = new Map<string, string[]>();
  for (const [id, list] of trimmed) {
    result.set(id, list.filter((other) => trimmed.get(other)?.includes(id)));
  }
  return result;
}

function getSnapshot(): Snapshot {
  if (snapshot === null) snapshot = loadSnapshot();
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
  if (event.key === STORAGE_KEY) {
    snapshot = loadSnapshot();
    emit();
  } else if (event.key === IMPORT_BACKUP_KEY || event.key?.startsWith(BACKUP_PREFIX)) {
    // В другой вкладке появилась, заменилась или удалилась копия
    refreshCopies();
  }
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
  // Изменение ничего не поменяло — сохранять и перерисовывать нечего
  if (next === current.data) return;
  // Прежнее сообщение не теряется после первого же действия — его скрывает только пользователь
  let notice = current.notice;
  if (!current.locked) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      notice = "Не удалось сохранить изменения: хранилище браузера переполнено или недоступно.";
    }
  }
  // Кнопка «скачать повреждённые данные» живёт вместе со своим сообщением: новое сообщение её убирает
  snapshot = { ...current, data: next, notice, brokenKey: notice === current.notice ? current.brokenKey : null };
  emit();
}

export function dismissNotice() {
  const current = getSnapshot();
  snapshot = { ...current, notice: null, brokenKey: null };
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
    tasks: d.tasks.map((t) => (t.goalId === id ? { ...t, goalId: null } : t)),
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

// Удаление проекта не удаляет задачи: они переходят к цели проекта или в «Неразобранные»
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

// Поля, которые можно задать сразу при создании (быстрый ввод)
export type NewTaskFields = {
  tags?: string[];
  priority?: Priority | null;
  deadline?: string | null;
  weight?: Weight | null;
};

export function addTask(title: string, parent: Parent, fields: NewTaskFields = {}): string | null {
  const clean = cleanTitle(title);
  if (!clean) return null;
  const createdAt = now();
  const id = newId();
  const deadline = fields.deadline && dayDate.safeParse(fields.deadline).success ? fields.deadline : null;
  update((d) => {
    // Теги — как при добавлении в карточке: уже известный тег берётся в записанном написании,
    // новый запоминается в справочнике; повторы и лишнее сверх предела отбрасываются
    let library = d.tags;
    const tags: string[] = [];
    for (const raw of fields.tags ?? []) {
      const tag = raw.trim().replace(/\s+/g, " ");
      if (!tag || tag.length > TAG_MAX || tags.length >= TAGS_PER_TASK) continue;
      if (tags.some((tg) => tagKey(tg) === tagKey(tag))) continue;
      const known = [...library, ...d.tasks.flatMap((t) => t.tags)].find((tg) => tagKey(tg) === tagKey(tag));
      if (!library.some((tg) => tagKey(tg) === tagKey(tag)) && library.length < TAG_LIBRARY_MAX) library = [...library, known ?? tag];
      tags.push(known ?? tag);
    }
    const task: Task = {
      id,
      title: clean,
      status: "todo",
      weight: fields.weight ?? null,
      ...parentFields(parent),
      description: "",
      deadline,
      priority: fields.priority ?? null,
      tags,
      relatedTaskIds: [],
      createdAt,
      doneAt: null,
      statusHistory: [{ status: "todo", at: createdAt }],
    };
    return { ...d, tags: library, tasks: [...d.tasks, task] };
  });
  return id;
}

const HISTORY_MAX = 1000;

// Смена статуса задачи: дата выполнения и запись в историю статусов
function withStatus(t: Task, status: Status, at: string): Task {
  if (t.status === status) return t;
  return {
    ...t,
    status,
    // Дата выполнения ставится при переходе в «Готово» и сбрасывается при выходе из него
    doneAt: status === "done" ? at : null,
    // Самые старые записи отбрасываются, чтобы история не росла бесконечно
    statusHistory: [...t.statusHistory, { status, at }].slice(-HISTORY_MAX),
  };
}

// Изменение одной задачи. Если patch вернул ту же задачу, данные не меняются — сохранять нечего.
function patchTask(id: string, patch: (t: Task) => Task) {
  update((d) => {
    let changed = false;
    const tasks = d.tasks.map((t) => {
      if (t.id !== id) return t;
      const next = patch(t);
      if (next !== t) changed = true;
      return next;
    });
    return changed ? { ...d, tasks } : d;
  });
}

export function renameTask(id: string, title: string) {
  const clean = cleanTitle(title);
  if (!clean) return;
  patchTask(id, (t) => ({ ...t, title: clean }));
}

export type Stopped = { taskId: string; minutes: number };

// Смена статуса. Если у задачи идёт таймер, любая смена (кроме «В работе») его останавливает
// и записывает время — возвращаются сведения об остановке для уведомления.
export function setTaskStatus(id: string, status: Status): Stopped | null {
  let stopped: Stopped | null = null;
  update((d) => {
    const task = d.tasks.find((t) => t.id === id);
    if (!task || task.status === status) return d;
    // Один момент времени и для конца отрезка таймера, и для записи в истории
    const moment = new Date();
    let base = d;
    if (d.timer?.taskId === id && status !== "in_progress") {
      const result = stopInData(d, moment);
      base = result.data;
      stopped = result.stopped;
    }
    const at = moment.toISOString();
    return { ...base, tasks: base.tasks.map((t) => (t.id === id ? withStatus(t, status, at) : t)) };
  });
  return stopped;
}

export function setTaskWeight(id: string, weight: Weight | null) {
  patchTask(id, (t) => ({ ...t, weight }));
}

export function moveTask(id: string, parent: Parent) {
  patchTask(id, (t) => ({ ...t, ...parentFields(parent) }));
}

export function setTaskDescription(id: string, description: string) {
  const clean = description.slice(0, DESCRIPTION_MAX);
  patchTask(id, (t) => (t.description === clean ? t : { ...t, description: clean }));
}

// Дедлайн — дата «ГГГГ-ММ-ДД» или null. Проверка той же схемой, что при загрузке:
// несуществующая дата иначе сохранилась бы, и при следующем открытии данные сочлись бы повреждёнными.
export function setTaskDeadline(id: string, deadline: string | null) {
  if (deadline !== null && !dayDate.safeParse(deadline).success) return;
  patchTask(id, (t) => (t.deadline === deadline ? t : { ...t, deadline }));
}

export function setTaskPriority(id: string, priority: Priority | null) {
  patchTask(id, (t) => (t.priority === priority ? t : { ...t, priority }));
}

// Тег: лишние пробелы убираются; если такой тег уже есть (без учёта регистра) — берётся его написание,
// чтобы не появлялись «работа» и «Работа». Возвращает текст ошибки или null.
export function addTaskTag(id: string, raw: string): string | null {
  const clean = raw.trim().replace(/\s+/g, " ");
  if (!clean) return null;
  if (clean.length > TAG_MAX) return `Тег — не длиннее ${TAG_MAX} символов.`;
  const data = getSnapshot().data;
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return null;
  const key = tagKey(clean);
  if (task.tags.some((tg) => tagKey(tg) === key)) return null;
  if (task.tags.length >= TAGS_PER_TASK) return `У задачи может быть не больше ${TAGS_PER_TASK} тегов — снимите один, чтобы добавить новый.`;
  // Уже известный тег берётся в записанном написании; новый — запоминается в справочнике
  const known = [...data.tags, ...data.tasks.flatMap((t) => t.tags)].find((tg) => tagKey(tg) === key);
  if (!known && data.tags.length >= TAG_LIBRARY_MAX) return `В справочнике может быть не больше ${TAG_LIBRARY_MAX} тегов.`;
  const tag = known ?? clean;
  update((d) => ({
    ...d,
    // Справочник полон (бывает только при очень старых или поправленных вручную данных) — тег ставится задаче,
    // но в справочник не дописывается: иначе следующая загрузка не прошла бы проверку схемой
    tags: d.tags.some((tg) => tagKey(tg) === key) || d.tags.length >= TAG_LIBRARY_MAX ? d.tags : [...d.tags, tag],
    tasks: d.tasks.map((t) => (t.id === id ? { ...t, tags: [...t.tags, tag] } : t)),
  }));
  return null;
}

// Снять тег с задачи; в справочнике он остаётся
export function removeTaskTag(id: string, tag: string) {
  patchTask(id, (t) => ({ ...t, tags: t.tags.filter((tg) => tg !== tag) }));
}

// Сколько задач с этим тегом (без учёта регистра) — для подтверждения удаления
export function tagUsage(tag: string): number {
  return getSnapshot().data.tasks.filter((t) => t.tags.some((tg) => tagKey(tg) === tagKey(tag))).length;
}

// Удалить тег из справочника и со всех задач
export function deleteTag(tag: string) {
  const key = tagKey(tag);
  update((d) => ({
    ...d,
    tags: d.tags.filter((tg) => tagKey(tg) !== key),
    tasks: d.tasks.map((t) => (t.tags.some((tg) => tagKey(tg) === key) ? { ...t, tags: t.tags.filter((tg) => tagKey(tg) !== key) } : t)),
  }));
}

// Связь задач — у обеих сразу. Возвращает текст ошибки или null.
export function linkTasks(a: string, b: string): string | null {
  if (a === b) return null;
  const tasks = getSnapshot().data.tasks;
  const first = tasks.find((t) => t.id === a);
  const second = tasks.find((t) => t.id === b);
  if (!first || !second || first.relatedTaskIds.includes(b)) return null;
  if (first.relatedTaskIds.length >= RELATED_MAX || second.relatedTaskIds.length >= RELATED_MAX) {
    return `У задачи может быть не больше ${RELATED_MAX} связанных задач.`;
  }
  update((d) => ({
    ...d,
    tasks: d.tasks.map((t) =>
      t.id === a ? { ...t, relatedTaskIds: [...t.relatedTaskIds, b] } : t.id === b ? { ...t, relatedTaskIds: [...t.relatedTaskIds, a] } : t,
    ),
  }));
  return null;
}

export function unlinkTasks(a: string, b: string) {
  update((d) => ({
    ...d,
    tasks: d.tasks.map((t) =>
      t.id === a || t.id === b ? { ...t, relatedTaskIds: t.relatedTaskIds.filter((r) => r !== a && r !== b) } : t,
    ),
  }));
}

// Вместе с задачей удаляются её записи времени, таймер и связи с ней
export function deleteTask(id: string) {
  update((d) => ({
    ...d,
    tasks: d.tasks
      .filter((t) => t.id !== id)
      .map((t) => (t.relatedTaskIds.includes(id) ? { ...t, relatedTaskIds: t.relatedTaskIds.filter((r) => r !== id) } : t)),
    timeEntries: d.timeEntries.filter((e) => e.taskId !== id),
    timer: d.timer?.taskId === id ? null : d.timer,
  }));
}

// --- Сохранённые подборки (в данных — views) ---

// Возвращает id новой подборки или текст ошибки
export function addView(name: string, filter: TaskFilter): { id: string } | { error: string } {
  const clean = name.trim().slice(0, VIEW_NAME_MAX);
  if (!clean) return { error: "Введите название подборки." };
  if (getSnapshot().data.views.length >= VIEWS_MAX) return { error: `Подборок может быть не больше ${VIEWS_MAX}.` };
  const view: SavedView = { id: newId(), name: clean, filter };
  update((d) => ({ ...d, views: [...d.views, view] }));
  return { id: view.id };
}

export function deleteView(id: string) {
  update((d) => ({ ...d, views: d.views.filter((v) => v.id !== id) }));
}

// --- Учёт времени ---

// Записи времени за отрезок [start, end]. Отрезок длиннее суток делится на части
// по 24 ч (запись не может быть длиннее суток). Время округляется до минут:
// отрезок короче 30 секунд не записывается.
function entriesForPeriod(taskId: string, start: Date, end: Date): TimeEntry[] {
  const total = Math.round((end.getTime() - start.getTime()) / 60000);
  const entries: TimeEntry[] = [];
  let offset = 0;
  while (total - offset >= 1) {
    const minutes = Math.min(ENTRY_MAX_MINUTES, total - offset);
    entries.push({
      id: newId(),
      taskId,
      start: new Date(start.getTime() + offset * 60000).toISOString(),
      minutes,
      source: "timer",
    });
    offset += minutes;
  }
  return entries;
}

// Останавливает таймер и записывает время. Возвращает задачу и записанные минуты.
function stopInData(d: AppData, end: Date): { data: AppData; stopped: Stopped | null } {
  if (d.timer === null) return { data: d, stopped: null };
  const start = new Date(d.timer.startedAt);
  const safeEnd = end.getTime() < start.getTime() ? start : end;
  const entries = entriesForPeriod(d.timer.taskId, start, safeEnd);
  const minutes = entries.reduce((sum, e) => sum + e.minutes, 0);
  return {
    data: { ...d, timer: null, timeEntries: [...d.timeEntries, ...entries] },
    stopped: { taskId: d.timer.taskId, minutes },
  };
}

// Запуск таймера. Таймер другой задачи останавливается (одновременно идёт один).
// Задача из «К выполнению» и «На паузе» переходит в «В работе»; «На проверке» статус не меняет
// (время проверки тоже учитывается); у выполненной задачи таймер не запускается.
export function startTimer(taskId: string): "started" | "done" | "missing" {
  let result: "started" | "done" | "missing" = "started";
  update((d) => {
    const task = d.tasks.find((t) => t.id === taskId);
    // Задачу могли удалить в другой вкладке — тогда ничего не запускаем
    if (!task) {
      result = "missing";
      return d;
    }
    if (task.status === "done") {
      result = "done";
      return d;
    }
    const base = d.timer !== null && d.timer.taskId !== taskId ? stopInData(d, new Date()).data : d;
    if (base.timer?.taskId === taskId) return base;
    const startedAt = new Date();
    const at = startedAt.toISOString();
    return {
      ...base,
      timer: {
        taskId,
        startedAt: at,
        remindAt: new Date(startedAt.getTime() + REMINDER_MS).toISOString(),
      },
      tasks: base.tasks.map((t) =>
        t.id === taskId && (t.status === "todo" || t.status === "paused") ? withStatus(t, "in_progress", at) : t,
      ),
    };
  });
  return result;
}

// Остановка таймера в момент end (по умолчанию — сейчас)
export function stopTimer(end: Date = new Date()): Stopped | null {
  let stopped: Stopped | null = null;
  update((d) => {
    const result = stopInData(d, end);
    stopped = result.stopped;
    return result.data;
  });
  return stopped;
}

// «Работа продолжается»: следующее напоминание — через час
export function snoozeTimer() {
  update((d) =>
    d.timer === null
      ? d
      : { ...d, timer: { ...d.timer, remindAt: new Date(Date.now() + REMINDER_MS).toISOString() } },
  );
}

// Ручной ввод: «потратила столько-то минут» в указанный день
export function addManualEntry(taskId: string, minutes: number, start: Date) {
  const clean = Math.round(minutes);
  if (clean < 1 || clean > ENTRY_MAX_MINUTES) return;
  const entry: TimeEntry = { id: newId(), taskId, start: start.toISOString(), minutes: clean, source: "manual" };
  update((d) => ({ ...d, timeEntries: [...d.timeEntries, entry] }));
}

export function setEntryMinutes(id: string, minutes: number) {
  const clean = Math.round(minutes);
  if (clean < 1 || clean > ENTRY_MAX_MINUTES) return;
  update((d) => ({ ...d, timeEntries: d.timeEntries.map((e) => (e.id === id ? { ...e, minutes: clean } : e)) }));
}

export function deleteEntry(id: string) {
  update((d) => ({ ...d, timeEntries: d.timeEntries.filter((e) => e.id !== id) }));
}

// --- Резервная копия ---

export function currentData(): AppData {
  return getSnapshot().data;
}

// Восстановление: заменяет все данные. Текущие данные сначала копируются
// под отдельный ключ, чтобы ошибочный импорт можно было откатить.
// Возвращает текст ошибки или null при успехе.
export function replaceAllData(imported: AppData): string | null {
  const current = getSnapshot();
  if (current.locked) {
    return "Сейчас изменения не сохраняются (см. сообщение выше), поэтому восстановление отключено.";
  }
  // Одна копия на ключ: каждое восстановление перезаписывает предыдущую, хранилище не забивается.
  // Прежнюю копию запоминаем, чтобы вернуть её, если восстановление сорвётся.
  const previousBackup = importBackupRaw();
  try {
    // Копия с датой сохранения — дата видна в «Хранилище копий»
    localStorage.setItem(IMPORT_BACKUP_KEY, JSON.stringify({ savedAt: now(), data: current.data }));
  } catch {
    return "Не удалось сохранить копию текущих данных перед восстановлением: хранилище браузера переполнено. Данные не изменены.";
  }
  const data = normalize(imported);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    try {
      if (previousBackup === null) localStorage.removeItem(IMPORT_BACKUP_KEY);
      else localStorage.setItem(IMPORT_BACKUP_KEY, previousBackup);
    } catch {
      // хранилище вернулось к прежнему объёму, место для прежней копии есть; на всякий случай не падаем
    }
    snapshot = { ...current, copies: readCopies() };
    emit();
    return "Не удалось сохранить данные из файла: хранилище браузера переполнено. Текущие данные не изменены.";
  }
  snapshot = { data, notice: IMPORT_NOTICE, locked: false, brokenKey: null, copies: readCopies() };
  emit();
  return null;
}

// Копия данных перед последним восстановлением «как есть» — для скачивания, даже если она не проходит проверку
export function importBackupRaw(): string | null {
  try {
    return localStorage.getItem(IMPORT_BACKUP_KEY);
  } catch {
    return null;
  }
}

// Копия данных перед последним восстановлением, проверенная схемой (null — копии нет или она испорчена)
export function importBackupData(): AppData | null {
  const raw = importBackupRaw();
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    // Новый формат — { savedAt, data }; старый — сами данные без обёртки
    const payload = parsed && typeof parsed === "object" && "savedAt" in parsed && "data" in parsed ? parsed.data : parsed;
    const result = appDataSchema.safeParse(payload);
    return result.success ? normalize(result.data) : null;
  } catch {
    return null;
  }
}

// Удаление копии до восстановления (например, испорченной — вернуть из неё данные всё равно нельзя)
export function deleteImportBackup() {
  try {
    localStorage.removeItem(IMPORT_BACKUP_KEY);
  } catch {
    // хранилище недоступно — удалять нечего
  }
  refreshCopies();
}

// Удаление копии повреждённых данных
export function deleteBrokenCopy() {
  try {
    for (const key of brokenKeys()) localStorage.removeItem(key);
  } catch {
    // хранилище недоступно — удалять нечего
  }
  // Сообщение о повреждённых данных, указывавшее на эту копию, уберёт refreshCopies
  refreshCopies();
}

// Отмена восстановления: возвращает данные, какими они были перед ним, и удаляет копию.
// Возвращает "broken", если копия испорчена, текст ошибки или null при успехе.
export function undoImport(): string | "broken" | null {
  if (getSnapshot().locked) {
    return "Сейчас изменения не сохраняются (см. сообщение выше), поэтому отмена восстановления отключена.";
  }
  const previous = importBackupData();
  if (previous === null) return importBackupRaw() === null ? "Копия прежних данных не найдена." : "broken";
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(previous));
  } catch {
    return "Не удалось вернуть прежние данные: хранилище браузера переполнено.";
  }
  try {
    localStorage.removeItem(IMPORT_BACKUP_KEY);
  } catch {
    // данные уже возвращены; копия останется, её можно удалить позже
  }
  snapshot = { data: previous, notice: "Прежние данные возвращены.", locked: false, brokenKey: null, copies: readCopies() };
  emit();
  return null;
}
