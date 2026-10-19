"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Circle, CircleCheck, CircleDot, CirclePause, Eye, Flag, X } from "lucide-react";
import { STATUS_LABELS, PRIORITY_LABELS, WEIGHT_HINTS, type AppData, type Status, type Task, type Weight } from "@/lib/model";
import { deadlineState, tagColor, todayKey } from "@/lib/filters";
import { formatDay, formatMinutes, sumMinutes } from "@/lib/time";
import { changeStatus, RunningTime, TimerButton } from "./TimeParts";
import { TaskEditor } from "./TaskEditor";
import { isTaskOpen, pathOf, PRIORITY_COLORS, useTaskUi } from "./task-ui";

// Порядок в списке: по времени создания — смена статуса задачу не двигает.
// Выполненные скрыты, их можно показать внизу списка (сначала недавно выполненные).
// showPath — показывать у каждой задачи, где она лежит (для общего списка «Все»).
// doneOpen — выполненные показаны сразу (например, когда фильтр отбирает только «Готово»).
export function TaskList({
  tasks,
  data,
  emptyText,
  showPath = false,
  doneOpen = false,
}: {
  tasks: Task[];
  data: AppData;
  emptyText: string;
  showPath?: boolean;
  doneOpen?: boolean;
}) {
  const { openTask, toggleTask } = useTaskUi();
  const [showDone, setShowDone] = useState(false);
  const active = tasks.filter((t) => t.status !== "done").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const done = tasks
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.doneAt ?? b.createdAt).localeCompare(a.doneAt ?? a.createdAt));
  if (tasks.length === 0) return <p className="px-2 py-3 text-sm text-zinc-500">{emptyText}</p>;
  // Переход к выполненной связанной задаче: её карточка открыта — значит, выполненные надо показать
  const openDone = done.find((t) => isTaskOpen(openTask, t));
  const doneVisible = doneOpen || showDone || openDone !== undefined;
  const toggleDone = () => {
    setShowDone(!doneVisible);
    // Скрываем выполненные вместе с открытой среди них карточкой
    if (doneVisible && openDone) toggleTask(openDone);
  };

  const row = (task: Task) => <TaskRow key={task.id} task={task} data={data} showPath={showPath} />;

  return (
    <div>
      {/* Для экранного диктора: отмеченная задача уходит из списка — сообщаем, сколько теперь выполненных */}
      <p role="status" className="sr-only">
        {done.length > 0 ? `Выполненных задач: ${done.length}` : ""}
      </p>
      {active.length > 0 ? (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">{active.map(row)}</ul>
      ) : (
        !doneOpen && <p className="px-2 py-3 text-sm text-zinc-500">Все задачи выполнены.</p>
      )}
      {done.length > 0 && (
        <>
          {!doneOpen && (
            <button
              type="button"
              onClick={toggleDone}
              aria-expanded={doneVisible}
              className="mt-1 rounded-md px-2 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              {doneVisible ? "Скрыть выполненные" : `Показать выполненные (${done.length})`}
            </button>
          )}
          {doneVisible && <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">{done.map(row)}</ul>}
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

export function weightTitle(weight: Weight) {
  return `${weight} SP — ${WEIGHT_HINTS[weight]}`;
}

// Дедлайн коротко: «22 окт.»; просроченный — красным, сегодняшний — янтарным
export function DeadlineText({ task, className = "" }: { task: Task; className?: string }) {
  if (task.deadline === null) return null;
  const state = deadlineState(task, todayKey());
  const color =
    state === "overdue"
      ? "text-red-600 dark:text-red-400"
      : state === "today"
        ? "text-amber-700 dark:text-amber-400"
        : "text-zinc-500";
  const label = state === "overdue" ? "просрочено" : state === "today" ? "сегодня" : null;
  const date = formatDay(new Date(`${task.deadline}T12:00:00`));
  return (
    <span className={`${color} ${className}`} title={`Дедлайн: ${date}${label ? ` (${label})` : ""}`}>
      {date}
      {label && <span className="sr-only"> ({label})</span>}
    </span>
  );
}

// Строка задачи. dragHandle — ручка для перетаскивания в начале строки (в календаре)
export function TaskRow({
  task,
  data,
  showPath,
  dragHandle,
}: {
  task: Task;
  data: AppData;
  showPath: boolean;
  dragHandle?: ReactNode;
}) {
  const { openTask, toggleTask, nav } = useTaskUi();
  const open = isTaskOpen(openTask, task);
  const done = task.status === "done";
  const running = data.timer?.taskId === task.id ? data.timer : null;
  const spent = sumMinutes(data.timeEntries.filter((e) => e.taskId === task.id));
  // Подсказка «таймер не запускается у выполненной задачи». Запоминаем дату выполнения, при которой
  // был отказ: если задачу вернули в работу и снова отметили выполненной, подсказка сама не всплывёт.
  const [blockedAt, setBlockedAt] = useState<string | null>(null);
  const blockedHint = done && blockedAt !== null && blockedAt === task.doneAt;

  // После перехода к этой задаче (например, из связанных) — прокрутить к ней один раз
  const rowRef = useRef<HTMLLIElement>(null);
  const scrolledSeq = useRef(0);
  useEffect(() => {
    if (open && nav !== null && nav.id === task.id && nav.seq !== scrolledSeq.current) {
      scrolledSeq.current = nav.seq;
      rowRef.current?.scrollIntoView({ block: "start" });
    }
  }, [open, nav, task.id]);

  return (
    <li ref={rowRef} className="scroll-mt-4 py-1">
      <div className="flex min-h-11 items-center gap-2 px-2">
        {dragHandle}
        <button
          type="button"
          onClick={() => changeStatus(task.id, done ? "todo" : "done")}
          aria-label={done ? "Снять отметку о выполнении" : "Отметить выполненной"}
          title={STATUS_LABELS[task.status]}
          className="shrink-0 rounded-full p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <StatusIcon status={task.status} />
        </button>
        <button type="button" onClick={() => toggleTask(task)} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <span className={`block truncate text-sm ${done ? "text-zinc-400 line-through" : ""}`}>{task.title}</span>
          {showPath && <span className="block truncate text-xs text-zinc-500">{pathOf(data, task)}</span>}
        </button>
        {task.tags.length > 0 && (
          <span className="hidden max-w-40 shrink-0 gap-1 overflow-hidden sm:flex">
            {task.tags.slice(0, 2).map((tg) => (
              <span key={tg} className={`truncate rounded px-1.5 py-0.5 text-xs ${tagColor(tg)}`}>
                {tg}
              </span>
            ))}
            {task.tags.length > 2 && <span className="text-xs text-zinc-500">+{task.tags.length - 2}</span>}
          </span>
        )}
        {task.priority !== null && (
          <span title={`Приоритет: ${PRIORITY_LABELS[task.priority]}`} className="shrink-0">
            <Flag size={14} className={PRIORITY_COLORS[task.priority]} aria-hidden="true" />
            <span className="sr-only">Приоритет: {PRIORITY_LABELS[task.priority]}</span>
          </span>
        )}
        <DeadlineText task={task} className="shrink-0 text-xs" />
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
      {open && <TaskEditor task={task} data={data} onClose={() => toggleTask(task)} />}
    </li>
  );
}
