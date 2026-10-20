"use client";

import { useState } from "react";
import { ClockAlert, Flag } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS, type AppData, type Status, type Task } from "@/lib/model";
import { deadlineState, tagColor, todayKey } from "@/lib/filters";
import { formatMinutes, sumMinutes } from "@/lib/time";
import { useAppUi } from "./app-ui";
import { Grip } from "./DragHandle";
import { DeadlineText, weightTitle } from "./TaskList";
import { changeStatus, RunningTime, TimerButton } from "./TimeParts";
import { pathOf, PRIORITY_COLORS, useTaskUi } from "./task-ui";

// Доска: колонка на каждый статус. Карточку задачи тянут в другую колонку — статус меняется
// так же, как в карточке (идущий таймер остановится с уведомлением, смена попадёт в историю статусов).
// По клику на название карточка задачи открывается в окне поверх доски.

// Колонка «Готово» по умолчанию показывает задачи, выполненные за последние 7 дней
const RECENT_DONE_DAYS = 7;

// Порядок в колонке: приоритет (высокий → низкий → без), затем дедлайн (ранний → поздний → без),
// затем время создания
function byPriority(a: Task, b: Task) {
  const rank = (t: Task) => (t.priority === null ? PRIORITIES.length : PRIORITIES.indexOf(t.priority));
  return (
    rank(a) - rank(b) ||
    (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") ||
    a.createdAt.localeCompare(b.createdAt)
  );
}

// Выполненные — сначала недавно выполненные, как в списке
function byDoneAt(a: Task, b: Task) {
  return (b.doneAt ?? b.createdAt).localeCompare(a.doneAt ?? a.createdAt);
}

// Когда закончился последний перенос. dnd-kit сам гасит клик после броска, но при проверке клик по названию
// после переноса всё же открывал окно — поэтому клик в первые 300 мс после переноса окно не открывает
let lastDragEnd = 0;
const justDragged = () => Date.now() - lastDragEnd < 300;

// Граница «выполнено за последние 7 дней» — момент 7 суток назад
function recentDoneSince(): string {
  return new Date(Date.now() - RECENT_DONE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

// Карточку тянут целиком — за название, ручку ⠿ или пустое место. Клик без сдвига мыши по-прежнему
// открывает карточку в окне или запускает таймер: перенос начинается только после сдвига на 5 px
function BoardCard({ task, data }: { task: Task; data: AppData }) {
  const { openInWindow } = useTaskUi();
  const { notify } = useAppUi();
  const { listeners, setNodeRef } = useDraggable({ id: task.id });
  const done = task.status === "done";
  const running = data.timer?.taskId === task.id ? data.timer : null;
  const spent = sumMinutes(data.timeEntries.filter((e) => e.taskId === task.id));
  const overdue = deadlineState(task, todayKey()) === "overdue";
  return (
    <li
      ref={setNodeRef}
      {...listeners}
      data-task-id={task.id}
      // select-none: долгое касание названия на телефоне не выделяет текст
      className="select-none rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-start gap-1.5">
        <Grip title="Перетащите в другую колонку" />
        {overdue && (
          <span title="Просрочено" className="mt-0.5 shrink-0">
            <ClockAlert size={16} className="text-red-600 dark:text-red-400" aria-hidden="true" />
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            if (!justDragged()) openInWindow(task.id);
          }}
          className="min-w-0 flex-1 cursor-grab rounded text-left active:cursor-grabbing"
        >
          <span className={`line-clamp-2 text-sm break-words ${done ? "text-zinc-400 line-through" : ""}`}>{task.title}</span>
          <span className="block truncate text-xs text-zinc-500">{pathOf(data, task)}</span>
        </button>
        <TimerButton
          task={task}
          running={running !== null}
          onBlocked={() =>
            notify({ kind: "info", text: `Задача «${task.title}» выполнена — таймер не запускается. Смените статус, чтобы снова работать над ней.` })
          }
        />
      </div>
      {(task.priority !== null || task.deadline !== null || task.weight !== null || task.tags.length > 0 || running || spent > 0) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 pl-5 text-xs">
          {task.priority !== null && (
            <span title={`Приоритет: ${PRIORITY_LABELS[task.priority]}`}>
              <Flag size={14} className={PRIORITY_COLORS[task.priority]} aria-hidden="true" />
              <span className="sr-only">Приоритет: {PRIORITY_LABELS[task.priority]}</span>
            </span>
          )}
          <DeadlineText task={task} />
          {task.weight !== null && (
            <span
              title={weightTitle(task.weight)}
              className="cursor-help rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
            >
              {task.weight} SP
            </span>
          )}
          {running ? (
            <RunningTime startedAt={running.startedAt} className="font-medium text-indigo-600 dark:text-indigo-400" />
          ) : (
            spent > 0 && <span className="text-zinc-500">{formatMinutes(spent)}</span>
          )}
          {task.tags.slice(0, 2).map((tg) => (
            <span key={tg} className={`max-w-24 truncate rounded px-1.5 py-0.5 ${tagColor(tg)}`}>
              {tg}
            </span>
          ))}
          {task.tags.length > 2 && <span className="text-zinc-500">+{task.tags.length - 2}</span>}
        </div>
      )}
    </li>
  );
}

function Column({
  status,
  tasks,
  allDone,
  showAllDone,
  onToggleDone,
  data,
}: {
  status: Status;
  tasks: Task[];
  // Только у «Готово»: сколько выполненных всего и показаны ли все
  allDone?: number;
  showAllDone?: boolean;
  onToggleDone?: () => void;
  data: AppData;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const recentOnly = allDone !== undefined && !showAllDone;
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`column-${status}`}
      className={`flex w-64 shrink-0 snap-start flex-col gap-2 rounded-lg border p-2 @4xl:w-auto @4xl:shrink ${
        isOver ? "border-dashed border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50" : "border-transparent bg-zinc-100 dark:bg-zinc-900/60"
      }`}
    >
      <h2 id={`column-${status}`} className="px-1 text-sm font-medium">
        {STATUS_LABELS[status]}
        {recentOnly && <span className="font-normal"> за {RECENT_DONE_DAYS} дней</span>}
        <span className="font-normal text-zinc-500"> · {tasks.length}</span>
      </h2>
      {tasks.length > 0 ? (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <BoardCard key={task.id} task={task} data={data} />
          ))}
        </ul>
      ) : (
        <p className="px-1 text-xs text-zinc-500">Перетащите сюда задачу.</p>
      )}
      {allDone !== undefined && onToggleDone && (showAllDone || allDone > tasks.length) && (
        <button
          type="button"
          onClick={onToggleDone}
          aria-expanded={showAllDone}
          className="self-start rounded-md px-1 py-1 text-xs text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          {showAllDone ? `Только за ${RECENT_DONE_DAYS} дней` : `Показать все (${allDone})`}
        </button>
      )}
    </section>
  );
}

// doneOpen — показать все выполненные сразу (например, когда фильтр отбирает «Готово»)
export function BoardView({ tasks, data, doneOpen = false }: { tasks: Task[]; data: AppData; doneOpen?: boolean }) {
  const [showAllDone, setShowAllDone] = useState(false);
  const [dragging, setDragging] = useState<Task | null>(null);
  // Как в календаре: мышью — после сдвига на 5 px, касанием — после короткого удержания, чтобы не мешать прокрутке
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const since = recentDoneSince();
  const allDone = tasks.filter((t) => t.status === "done").sort(byDoneAt);
  const doneShown = doneOpen || showAllDone ? allDone : allDone.filter((t) => (t.doneAt ?? "") >= since);
  const columnTasks = (status: Status) => tasks.filter((t) => t.status === status).sort(byPriority);

  const titleOf = (id: string | number) => tasks.find((t) => t.id === id)?.title ?? "";
  const columnOf = (id: string | number | undefined) =>
    id !== undefined && (STATUSES as readonly string[]).includes(String(id)) ? (String(id) as Status) : null;
  // Объявления для экранного диктора — по-русски
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Задача «${titleOf(active.id)}» взята.`,
    onDragOver: ({ active, over }) => {
      const column = columnOf(over?.id);
      return `Задача «${titleOf(active.id)}»: ${column ? `колонка «${STATUS_LABELS[column]}»` : "вне доски"}.`;
    },
    onDragEnd: ({ active, over }) => {
      const column = columnOf(over?.id);
      const task = tasks.find((t) => t.id === active.id);
      return column && task?.status !== column
        ? `Задача «${titleOf(active.id)}» перенесена в «${STATUS_LABELS[column]}».`
        : `Задача «${titleOf(active.id)}» возвращена на место.`;
    },
    onDragCancel: ({ active }) => `Перенос задачи «${titleOf(active.id)}» отменён.`,
  };

  const onDragStart = ({ active }: DragStartEvent) => setDragging(tasks.find((t) => t.id === active.id) ?? null);
  // Смена статуса — тем же путём, что в карточке и в строке списка
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    lastDragEnd = Date.now();
    const column = columnOf(over?.id);
    const task = tasks.find((t) => t.id === active.id);
    if (column && task && task.status !== column) changeStatus(task.id, column);
  };

  return (
    <DndContext
      sensors={sensors}
      // Колонка — та, что под указателем (пальцем). По умолчанию считалось бы пересечение с плашкой
      // перетаскиваемой задачи, а она шире точки, за которую взяли, — задача попадала бы в соседнюю колонку
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDragging(null);
        lastDragEnd = Date.now();
      }}
      accessibility={{ announcements }}
    >
      {/* Узкий экран: колонки листаются вбок внутри доски; широкий — все пять в ряд */}
      <div className="@container">
        <div className="flex snap-x gap-2 overflow-x-auto pb-2 @4xl:grid @4xl:grid-cols-5 @4xl:overflow-visible">
          {STATUSES.map((status) =>
            status === "done" ? (
              <Column
                key={status}
                status={status}
                tasks={doneShown}
                allDone={doneOpen ? undefined : allDone.length}
                showAllDone={showAllDone}
                onToggleDone={() => setShowAllDone(!showAllDone)}
                data={data}
              />
            ) : (
              <Column key={status} status={status} tasks={columnTasks(status)} data={data} />
            ),
          )}
        </div>
      </div>
      {/* Без анимации возврата: иначе после броска плашка ещё летит к старому месту карточки,
          хотя задача уже в новой колонке */}
      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="w-max max-w-64 cursor-grabbing truncate rounded-md border border-indigo-300 bg-white px-2 py-1 text-sm shadow-md dark:border-indigo-700 dark:bg-zinc-900">
            {dragging.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
