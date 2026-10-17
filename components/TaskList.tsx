"use client";

import { useState } from "react";
import { Circle, CircleCheck, CircleDot, Eye, Trash, X } from "lucide-react";
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
import { deleteTask, moveTask, renameTask, setTaskStatus, setTaskWeight } from "@/lib/store";

// Порядок в списке: начатые сверху, выполненные внизу
const STATUS_ORDER: Record<Status, number> = { in_progress: 0, review: 1, todo: 2, done: 3 };

export function TaskList({ tasks, data, emptyText }: { tasks: Task[]; data: AppData; emptyText: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const sorted = [...tasks].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.createdAt.localeCompare(b.createdAt),
  );
  if (sorted.length === 0) return <p className="px-2 py-3 text-sm text-zinc-500">{emptyText}</p>;
  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {sorted.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          data={data}
          open={openId === task.id}
          onToggle={() => setOpenId(openId === task.id ? null : task.id)}
        />
      ))}
    </ul>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "done") return <CircleCheck size={20} className="text-indigo-500" aria-hidden="true" />;
  if (status === "in_progress") return <CircleDot size={20} className="text-amber-500" aria-hidden="true" />;
  if (status === "review") return <Eye size={20} className="text-sky-500" aria-hidden="true" />;
  return <Circle size={20} className="text-zinc-400" aria-hidden="true" />;
}

function weightTitle(weight: Weight) {
  return `${weight} SP — ${WEIGHT_HINTS[weight]}`;
}

function TaskRow({ task, data, open, onToggle }: { task: Task; data: AppData; open: boolean; onToggle: () => void }) {
  const done = task.status === "done";
  return (
    <li className="py-1">
      <div className="flex min-h-11 items-center gap-2 px-2">
        <button
          type="button"
          onClick={() => setTaskStatus(task.id, done ? "todo" : "done")}
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
          className={`min-w-0 flex-1 truncate text-left text-sm ${done ? "text-zinc-400 line-through" : ""}`}
        >
          {task.title}
        </button>
        {(task.status === "in_progress" || task.status === "review") && (
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
      </div>
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
            onChange={(e) => setTaskStatus(task.id, e.target.value as Status)}
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
            <option value="inbox">Входящие</option>
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
