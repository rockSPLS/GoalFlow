"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { AppData, Task } from "@/lib/model";
import { deadlineState, todayKey } from "@/lib/filters";
import { setTaskDeadline } from "@/lib/store";
import { addDays, formatDay, formatMonth, formatWeekday, startOfWeek, toDateInputValue } from "@/lib/time";
import { DragHandle } from "./DragHandle";
import { TaskRow } from "./TaskList";

// Календарь: компактный месяц (в клетке — число задач) и список задач выбранного дня с параметрами.
// Задачу тянут за ручку ⠿ на день месяца — дедлайн меняется; в список «Без дедлайна» — дедлайн убирается.
// Выполненные задачи видны зачёркнутыми.

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const NO_DEADLINE = "none";
// Список выбранного дня тоже принимает задачу: его id — «day:ГГГГ-ММ-ДД» (у клетки — просто дата)
const DAY_LIST = "day:";

function firstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// Недели (с понедельника), которые покрывают месяц целиком
function monthWeeks(month: Date): Date[][] {
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const weeks: Date[][] = [];
  for (let start = startOfWeek(month); start <= last; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
  }
  return weeks;
}

// Сначала невыполненные (по времени создания), выполненные — в конце
function byOrder(a: Task, b: Task) {
  return Number(a.status === "done") - Number(b.status === "done") || a.createdAt.localeCompare(b.createdAt);
}

const dayOf = (key: string) => new Date(`${key}T12:00:00`);
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function TaskRows({ tasks, data }: { tasks: Task[]; data: AppData }) {
  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} data={data} showPath dragHandle={<DragHandle id={task.id} title="Перетащите на день в календаре" />} />
      ))}
    </ul>
  );
}

function DayCell({
  day,
  inMonth,
  today,
  selected,
  tasks,
  onSelect,
}: {
  day: Date;
  inMonth: boolean;
  today: string;
  selected: boolean;
  tasks: Task[];
  onSelect: () => void;
}) {
  const key = toDateInputValue(day);
  const { setNodeRef, isOver } = useDroppable({ id: key });
  const isToday = key === today;
  const open = tasks.filter((t) => t.status !== "done").length;
  const overdue = tasks.some((t) => deadlineState(t, today) === "overdue");
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${formatWeekday(day)}${tasks.length ? `, задач: ${tasks.length}` : ", задач нет"}${overdue ? ", есть просроченные" : ""}`}
      className={`flex min-h-12 min-w-0 flex-col items-start justify-between rounded-md border p-1 text-left ${
        isOver
          ? "border-dashed border-indigo-500 bg-indigo-100 dark:bg-indigo-950"
          : selected
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60"
            : isToday
              ? "border-indigo-300 hover:bg-zinc-50 dark:border-indigo-800 dark:hover:bg-zinc-900"
              : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
      } ${inMonth ? "" : "opacity-50"}`}
    >
      <span className={`text-xs ${isToday ? "font-semibold text-indigo-600 dark:text-indigo-400" : "text-zinc-500"}`}>{day.getDate()}</span>
      {tasks.length > 0 && (
        <span
          className={`self-end rounded-full px-1.5 text-xs leading-5 ${
            overdue
              ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
              : open > 0
                ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
          }`}
        >
          {tasks.length}
        </span>
      )}
    </button>
  );
}

// Задачи выбранного дня
function DaySection({ day, today, tasks, data }: { day: string; today: string; tasks: Task[]; data: AppData }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${DAY_LIST}${day}` });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby="day-heading"
      className={`rounded-md border p-2 ${isOver ? "border-dashed border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50" : "border-transparent"}`}
    >
      <h2 id="day-heading" aria-live="polite" className="px-2 text-sm font-medium">
        {capitalize(formatWeekday(dayOf(day)))}
        {day === today ? " — сегодня" : ""}
        <span className="font-normal text-zinc-500"> · задач: {tasks.length}</span>
      </h2>
      {tasks.length > 0 ? (
        <TaskRows tasks={tasks} data={data} />
      ) : (
        <p className="px-2 py-2 text-sm text-zinc-500">На этот день задач нет. Выберите другой день или перетащите сюда задачу.</p>
      )}
    </section>
  );
}

// Список «Без дедлайна» — тоже место, куда можно бросить задачу (дедлайн уберётся)
function NoDeadlineSection({ tasks, data }: { tasks: Task[]; data: AppData }) {
  const { setNodeRef, isOver } = useDroppable({ id: NO_DEADLINE });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby="no-deadline-heading"
      className={`rounded-md border p-2 ${isOver ? "border-dashed border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50" : "border-zinc-200 dark:border-zinc-800"}`}
    >
      <h2 id="no-deadline-heading" className="px-2 text-sm font-medium">
        Без дедлайна ({tasks.length})
      </h2>
      <p className="px-2 text-xs text-zinc-500">Перетащите задачу за ⠿ на день в календаре, чтобы назначить дедлайн.</p>
      {tasks.length > 0 && <TaskRows tasks={tasks} data={data} />}
    </section>
  );
}

export function CalendarView({ tasks, data }: { tasks: Task[]; data: AppData }) {
  const today = todayKey();
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
  const [selected, setSelected] = useState(today);
  const [dragging, setDragging] = useState<Task | null>(null);
  // Перетаскивание начинается, если мышь сдвинули на 5 px; касанием — после короткого удержания,
  // чтобы не мешать прокрутке страницы
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const byDay = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.deadline === null) continue;
    byDay.set(t.deadline, [...(byDay.get(t.deadline) ?? []), t]);
  }
  const dayTasks = [...(byDay.get(selected) ?? [])].sort(byOrder);
  const noDeadline = tasks.filter((t) => t.deadline === null && t.status !== "done").sort(byOrder);

  const titleOf = (id: string | number) => tasks.find((t) => t.id === id)?.title ?? "";
  // Куда брошена задача: дата, «без дедлайна» или null (мимо)
  const targetOf = (id: string | number | undefined): string | null | undefined =>
    id === undefined ? undefined : id === NO_DEADLINE ? null : String(id).replace(DAY_LIST, "");
  const placeOf = (id: string | number | undefined) => {
    const target = targetOf(id);
    return target === undefined ? "вне календаря" : target === null ? "без дедлайна" : formatDay(dayOf(target));
  };
  // Объявления для экранного диктора — по-русски
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Задача «${titleOf(active.id)}» взята.`,
    onDragOver: ({ active, over }) => `Задача «${titleOf(active.id)}»: ${placeOf(over?.id)}.`,
    onDragEnd: ({ active, over }) =>
      over ? `Задача «${titleOf(active.id)}» перенесена: ${placeOf(over.id)}.` : `Задача «${titleOf(active.id)}» возвращена на место.`,
    onDragCancel: ({ active }) => `Перенос задачи «${titleOf(active.id)}» отменён.`,
  };

  const onDragStart = ({ active }: DragStartEvent) => setDragging(tasks.find((t) => t.id === active.id) ?? null);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    const target = targetOf(over?.id);
    if (target !== undefined) setTaskDeadline(String(active.id), target);
  };

  // При листании выбранный день переходит в показанный месяц: сегодня, если оно там, иначе первое число
  const showMonth = (next: Date) => {
    setMonth(next);
    const now = new Date();
    const sameMonth = now.getFullYear() === next.getFullYear() && now.getMonth() === next.getMonth();
    setSelected(sameMonth ? today : toDateInputValue(next));
  };

  const arrow = (label: string, onClick: () => void, icon: ReactNode) => (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="rounded-md p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
      {icon}
    </button>
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
      accessibility={{ announcements }}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1">
            {arrow("Предыдущий месяц", () => showMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)), <ChevronLeft size={18} aria-hidden="true" />)}
            <h2 className="min-w-36 text-center text-sm font-medium">{formatMonth(month)}</h2>
            {arrow("Следующий месяц", () => showMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)), <ChevronRight size={18} aria-hidden="true" />)}
            <button
              type="button"
              onClick={() => {
                setMonth(firstOfMonth(new Date()));
                setSelected(today);
              }}
              className="ml-2 rounded-md border border-zinc-300 px-2.5 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Сегодня
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-xs text-zinc-500" aria-hidden="true">
                {d}
              </div>
            ))}
            {monthWeeks(month).flatMap((week) =>
              week.map((day) => {
                const key = toDateInputValue(day);
                return (
                  <DayCell
                    key={key}
                    day={day}
                    inMonth={day.getMonth() === month.getMonth()}
                    today={today}
                    selected={key === selected}
                    tasks={byDay.get(key) ?? []}
                    onSelect={() => setSelected(key)}
                  />
                );
              }),
            )}
          </div>
        </div>

        <DaySection day={selected} today={today} tasks={dayTasks} data={data} />

        <NoDeadlineSection tasks={noDeadline} data={data} />
      </div>
      {/* Без анимации возврата: иначе после броска плашка ещё летит к старому месту ручки,
          хотя задача уже в другом дне */}
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
