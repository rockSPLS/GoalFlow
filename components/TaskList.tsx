"use client";

import { useState } from "react";
import { Circle, CircleCheck, CircleDot, CirclePause, Eye, Trash, X } from "lucide-react";
import {
  DEFAULT_WEIGHT,
  STATUSES,
  STATUS_LABELS,
  TITLE_MAX,
  WEIGHTS,
  WEIGHT_HINTS,
  type AppData,
  type Parent,
  type Status,
  type Task,
  type Weight,
} from "@/lib/model";
import { deleteTask, moveTask, renameTask, setTaskWeight } from "@/lib/store";
import { formatMinutes, sumMinutes } from "@/lib/time";
import { changeStatus, RunningTime, TaskTimeSection, TimerButton } from "./TimeParts";

// Порядок в списке: по времени создания — смена статуса задачу не двигает.
// Выполненные скрыты, их можно показать внизу списка (сначала недавно выполненные).
// showPath — показывать у каждой задачи, где она лежит (для общего списка «Все»)
export function TaskList({
  tasks,
  data,
  emptyText,
  showPath = false,
}: {
  tasks: Task[];
  data: AppData;
  emptyText: string;
  showPath?: boolean;
}) {
  // Открытая карточка запоминается вместе с признаком «выполнена»: когда задача уходит
  // в выполненные (или возвращается), карточка закрывается и сама потом не открывается
  const [openKey, setOpenKey] = useState<string | null>(null);
  const keyOf = (task: Task) => `${task.id}:${task.status === "done"}`;
  const [showDone, setShowDone] = useState(false);
  const active = tasks.filter((t) => t.status !== "done").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const done = tasks
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.doneAt ?? b.createdAt).localeCompare(a.doneAt ?? a.createdAt));
  if (tasks.length === 0) return <p className="px-2 py-3 text-sm text-zinc-500">{emptyText}</p>;

  const row = (task: Task) => (
    <TaskRow
      key={task.id}
      task={task}
      data={data}
      open={openKey === keyOf(task)}
      onToggle={() => setOpenKey(openKey === keyOf(task) ? null : keyOf(task))}
      path={showPath ? pathOf(data, task) : null}
    />
  );

  return (
    <div>
      {/* Для экранного диктора: отмеченная задача уходит из списка — сообщаем, сколько теперь выполненных */}
      <p role="status" className="sr-only">
        {done.length > 0 ? `Выполненных задач: ${done.length}` : ""}
      </p>
      {active.length > 0 ? (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">{active.map(row)}</ul>
      ) : (
        <p className="px-2 py-3 text-sm text-zinc-500">Все задачи выполнены.</p>
      )}
      {done.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowDone(!showDone)}
            aria-expanded={showDone}
            className="mt-1 rounded-md px-2 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            {showDone ? "Скрыть выполненные" : `Показать выполненные (${done.length})`}
          </button>
          {showDone && <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">{done.map(row)}</ul>}
        </>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "done") return <CircleCheck size={20} className="text-indigo-500" aria-hidden="true" />;
  if (status === "in_progress") return <CircleDot size={20} className="text-amber-500" aria-hidden="true" />;
  if (status === "review") return <Eye size={20} className="text-sky-500" aria-hidden="true" />;
  if (status === "paused") return <CirclePause size={20} className="text-zinc-500" aria-hidden="true" />;
  return <Circle size={20} className="text-zinc-400" aria-hidden="true" />;
}

function weightTitle(weight: Weight) {
  return `${weight} SP — ${WEIGHT_HINTS[weight]}`;
}

// Где лежит задача: «Цель › Проект», «Цель», «Проект» (без цели) или «Неразобранные»
function pathOf(data: AppData, task: Task): string {
  if (task.projectId !== null) {
    const project = data.projects.find((p) => p.id === task.projectId);
    const goal = project?.goalId ? data.goals.find((g) => g.id === project.goalId) : undefined;
    return goal ? `${goal.title} › ${project?.title ?? ""}` : (project?.title ?? "");
  }
  if (task.goalId !== null) return data.goals.find((g) => g.id === task.goalId)?.title ?? "";
  return "Неразобранные";
}

function TaskRow({
  task,
  data,
  open,
  onToggle,
  path,
}: {
  task: Task;
  data: AppData;
  open: boolean;
  onToggle: () => void;
  path: string | null;
}) {
  const done = task.status === "done";
  const running = data.timer?.taskId === task.id ? data.timer : null;
  const spent = sumMinutes(data.timeEntries.filter((e) => e.taskId === task.id));
  // Подсказка «таймер не запускается у выполненной задачи». Запоминаем дату выполнения, при которой
  // был отказ: если задачу вернули в работу и снова отметили выполненной, подсказка сама не всплывёт.
  const [blockedAt, setBlockedAt] = useState<string | null>(null);
  const blockedHint = done && blockedAt !== null && blockedAt === task.doneAt;
  return (
    <li className="py-1">
      <div className="flex min-h-11 items-center gap-2 px-2">
        <button
          type="button"
          onClick={() => changeStatus(task.id, done ? "todo" : "done")}
          aria-label={done ? "Снять отметку о выполнении" : "Отметить выполненной"}
          title={STATUS_LABELS[task.status]}
          className="shrink-0 rounded-full p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <StatusIcon status={task.status} />
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <span className={`block truncate text-sm ${done ? "text-zinc-400 line-through" : ""}`}>{task.title}</span>
          {path !== null && <span className="block truncate text-xs text-zinc-500">{path}</span>}
        </button>
        {(task.status === "in_progress" || task.status === "paused" || task.status === "review") && (
          <span className="hidden shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 sm:inline dark:bg-zinc-800 dark:text-zinc-300">
            {STATUS_LABELS[task.status]}
          </span>
        )}
        {task.weight !== null && (
          <span
            title={weightTitle(task.weight)}
            className="shrink-0 cursor-help rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
          >
            {task.weight} SP
          </span>
        )}
        {running ? (
          <RunningTime startedAt={running.startedAt} className="shrink-0 text-xs font-medium text-indigo-600 dark:text-indigo-400" />
        ) : (
          spent > 0 && <span className="shrink-0 text-xs text-zinc-500">{formatMinutes(spent)}</span>
        )}
        <TimerButton task={task} running={running !== null} onBlocked={() => setBlockedAt(task.doneAt)} />
      </div>
      {blockedHint && (
        <p role="status" className="mx-2 mb-1 flex items-center gap-2 rounded-md bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <span className="flex-1">Задача выполнена. Чтобы снова работать над ней, смените статус.</span>
          <button type="button" onClick={() => setBlockedAt(null)} aria-label="Скрыть подсказку" className="rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700">
            <X size={14} aria-hidden="true" />
          </button>
        </p>
      )}
      {open && <TaskEditor task={task} data={data} onClose={onToggle} />}
    </li>
  );
}

function parentValue(task: Task): string {
  if (task.projectId) return `project:${task.projectId}`;
  if (task.goalId) return `goal:${task.goalId}`;
  return "inbox";
}

function parseParent(value: string): Parent {
  const sep = value.indexOf(":");
  const kind = sep === -1 ? value : value.slice(0, sep);
  const id = sep === -1 ? "" : value.slice(sep + 1);
  if (kind === "project" && id) return { kind: "project", id };
  if (kind === "goal" && id) return { kind: "goal", id };
  return { kind: "inbox" };
}

const fieldClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

// Карточка задачи: название, статус, вес, родитель, удаление
function TaskEditor({ task, data, onClose }: { task: Task; data: AppData; onClose: () => void }) {
  const [title, setTitle] = useState(task.title);
  const orphanProjects = data.projects.filter((p) => p.goalId === null);

  const saveTitle = () => {
    if (title.trim() && title.trim() !== task.title) renameTask(task.id, title);
    else setTitle(task.title);
  };

  return (
    <div className="mx-2 mb-2 space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex items-start gap-2">
        <input
          value={title}
          maxLength={TITLE_MAX}
          aria-label="Название задачи"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setTitle(task.title);
          }}
          className={`${fieldClass} flex-1`}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть карточку задачи"
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Статус
          <select
            value={task.status}
            onChange={(e) => changeStatus(task.id, e.target.value as Status)}
            className={`${fieldClass} text-zinc-900 dark:text-zinc-100`}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-zinc-500">
          Где лежит
          <select
            value={parentValue(task)}
            onChange={(e) => moveTask(task.id, parseParent(e.target.value))}
            className={`${fieldClass} max-w-full text-zinc-900 dark:text-zinc-100`}
          >
            <option value="inbox">Неразобранные</option>
            {data.goals.map((g) => (
              <optgroup key={g.id} label={`Цель: ${g.title}`}>
                <option value={`goal:${g.id}`}>{g.title} — без проекта</option>
                {data.projects
                  .filter((p) => p.goalId === g.id)
                  .map((p) => (
                    <option key={p.id} value={`project:${p.id}`}>
                      Проект: {p.title}
                    </option>
                  ))}
              </optgroup>
            ))}
            {orphanProjects.length > 0 && (
              <optgroup label="Проекты без цели">
                {orphanProjects.map((p) => (
                  <option key={p.id} value={`project:${p.id}`}>
                    Проект: {p.title}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
      </div>

      <WeightPicker value={task.weight} onChange={(w) => setTaskWeight(task.id, w)} />

      <TaskTimeSection task={task} data={data} />

      <button
        type="button"
        onClick={() => {
          if (window.confirm(`Удалить задачу «${task.title}»?`)) deleteTask(task.id);
        }}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
      >
        <Trash size={16} aria-hidden="true" />
        Удалить задачу
      </button>
    </div>
  );
}

// Выбор веса с расшифровкой каждого значения
function WeightPicker({ value, onChange }: { value: Weight | null; onChange: (w: Weight | null) => void }) {
  const optionClass = (active: boolean) =>
    `flex flex-col items-start rounded-md border px-3 py-2 text-left text-sm ${
      active
        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
        : "border-zinc-300 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
    }`;
  return (
    <fieldset>
      <legend className="mb-1 text-xs text-zinc-500">Вес задачи (story points, SP) — влияет на прогресс цели</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={optionClass(value === null)}>
          <span className="font-medium">Без веса</span>
          <span className="text-xs text-zinc-500">считается как {DEFAULT_WEIGHT} SP</span>
        </button>
        {WEIGHTS.map((w) => (
          <button
            key={w}
            type="button"
            aria-pressed={value === w}
            onClick={() => onChange(w)}
            title={weightTitle(w)}
            className={optionClass(value === w)}
          >
            <span className="font-medium">{w} SP</span>
            <span className="text-xs text-zinc-500">{WEIGHT_HINTS[w]}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
