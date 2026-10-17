"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AppData, TimeEntry } from "@/lib/model";
import { useNow } from "@/lib/clock";
import {
  addDays,
  entriesBetween,
  formatDay,
  formatMinutes,
  formatMonth,
  formatWeekday,
  goalIdOfTask,
  startOfDay,
  startOfWeek,
  sumMinutes,
} from "@/lib/time";

// Экран «Время»: итоги за сегодня и за выбранный период — неделю (с понедельника) или месяц,
// с переходом к прошлым периодам. Разбивка по целям и по дням (неделя) или неделям (месяц).
// Считаются сохранённые записи; идущий таймер попадёт в итоги после остановки.

function byGoal(data: AppData, entries: TimeEntry[]) {
  const totals = new Map<string | null, number>();
  for (const e of entries) {
    const goalId = goalIdOfTask(data, e.taskId);
    totals.set(goalId, (totals.get(goalId) ?? 0) + e.minutes);
  }
  return [...totals.entries()]
    .map(([goalId, minutes]) => ({
      key: goalId ?? "none",
      title: goalId === null ? "Без цели" : (data.goals.find((g) => g.id === goalId)?.title ?? "Без цели"),
      minutes,
    }))
    .sort((a, b) => b.minutes - a.minutes);
}

function GoalTotals({ data, entries, emptyText }: { data: AppData; entries: TimeEntry[]; emptyText: string }) {
  const rows = byGoal(data, entries);
  if (rows.length === 0) return <p className="text-sm text-zinc-500">{emptyText}</p>;
  const max = rows[0].minutes;
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.key} className="space-y-1">
          <div className="flex justify-between gap-2 text-sm">
            <span className="truncate">{row.title}</span>
            <span className="shrink-0 text-zinc-500">{formatMinutes(row.minutes)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden="true">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(row.minutes / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

type Mode = "week" | "month";

// Строки разбивки периода: у недели — дни, у месяца — недели (обрезанные по границам месяца)
type Row = { key: string; label: string; from: Date; to: Date; current: boolean };

// Подпись промежутка [from, to): «12 окт. – 18 окт.», один день — одна дата;
// год дописывается, если промежуток не в текущем году
function rangeLabel(from: Date, to: Date, now: Date): string {
  const last = addDays(to, -1);
  const thisYear = now.getFullYear();
  if (last.getTime() === from.getTime()) {
    return from.getFullYear() === thisYear ? formatDay(from) : `${formatDay(from)} ${from.getFullYear()}`;
  }
  if (from.getFullYear() === thisYear && last.getFullYear() === thisYear) return `${formatDay(from)} – ${formatDay(last)}`;
  // Промежуток на стыке лет — год у обеих дат
  if (from.getFullYear() !== last.getFullYear()) {
    return `${formatDay(from)} ${from.getFullYear()} – ${formatDay(last)} ${last.getFullYear()}`;
  }
  return `${formatDay(from)} – ${formatDay(last)} ${last.getFullYear()}`;
}

function periodOf(now: Date, mode: Mode, offset: number) {
  const today = startOfDay(now);
  if (mode === "week") {
    const from = addDays(startOfWeek(now), offset * 7);
    const to = addDays(from, 7);
    const rows: Row[] = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(from, i);
      return { key: day.toISOString(), label: formatWeekday(day), from: day, to: addDays(day, 1), current: day.getTime() === today.getTime() };
    });
    const title = offset === 0 ? "Эта неделя" : offset === -1 ? "Прошлая неделя" : rangeLabel(from, to, now);
    return { from, to, rows, title, rowsTitle: "По дням" };
  }
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  const rows: Row[] = [];
  for (let weekStart = startOfWeek(from); weekStart < to; weekStart = addDays(weekStart, 7)) {
    const rowFrom = weekStart < from ? from : weekStart;
    const weekEnd = addDays(weekStart, 7);
    const rowTo = weekEnd > to ? to : weekEnd;
    rows.push({
      key: rowFrom.toISOString(),
      label: rangeLabel(rowFrom, rowTo, now),
      from: rowFrom,
      to: rowTo,
      current: today >= rowFrom && today < rowTo,
    });
  }
  const title = offset === 0 ? "Этот месяц" : formatMonth(from);
  return { from, to, rows, title, rowsTitle: "По неделям" };
}

// Размеры кнопок — не меньше 44 px по высоте, чтобы попадать пальцем на телефоне
const toggleClass = (active: boolean) =>
  `min-h-11 rounded-md px-3 py-2 text-sm ${active ? "bg-zinc-200 font-medium dark:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"}`;

const arrowClass =
  "flex min-h-11 min-w-11 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

export function TimeView({ data }: { data: AppData }) {
  // Часы нужны, чтобы «сегодня» сменилось после полуночи без перезагрузки
  const now = new Date(useNow());
  const today = startOfDay(now);
  const todayEntries = entriesBetween(data.timeEntries, today, addDays(today, 1));

  // Период: неделя или месяц; offset — сколько периодов назад (0 — текущий)
  const [mode, setMode] = useState<Mode>("week");
  const [offset, setOffset] = useState(0);
  const period = periodOf(now, mode, offset);
  const periodEntries = entriesBetween(data.timeEntries, period.from, period.to);
  const switchMode = (next: Mode) => {
    setMode(next);
    setOffset(0);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Время</h1>
        <p className="text-sm text-zinc-500">Сколько времени ушло и на какие цели. Идущий таймер попадёт в итоги после остановки.</p>
      </div>

      <section className="space-y-3">
        <h2 className="flex justify-between text-lg font-medium">
          <span>Сегодня</span>
          <span className="text-zinc-500">{formatMinutes(sumMinutes(todayEntries))}</span>
        </h2>
        <GoalTotals data={data} entries={todayEntries} emptyText="Сегодня время ещё не записано." />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1" role="group" aria-label="Период">
            <button type="button" aria-pressed={mode === "week"} onClick={() => switchMode("week")} className={toggleClass(mode === "week")}>
              Неделя
            </button>
            <button type="button" aria-pressed={mode === "month"} onClick={() => switchMode("month")} className={toggleClass(mode === "month")}>
              Месяц
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOffset(offset - 1)}
              aria-label={mode === "week" ? "Предыдущая неделя" : "Предыдущий месяц"}
              className={arrowClass}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setOffset(offset + 1)}
              disabled={offset === 0}
              aria-label={mode === "week" ? "Следующая неделя" : "Следующий месяц"}
              className={arrowClass}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        {/* aria-live: после нажатия стрелки экранный диктор объявит новый период */}
        <h2 aria-live="polite" className="flex justify-between text-lg font-medium">
          <span>{period.title}</span>
          <span className="text-zinc-500">{formatMinutes(sumMinutes(periodEntries))}</span>
        </h2>
        <GoalTotals data={data} entries={periodEntries} emptyText="За этот период время не записано." />
        <h3 className="pt-2 text-sm font-medium text-zinc-500">{period.rowsTitle}</h3>
        <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          {period.rows.map((row) => {
            const minutes = sumMinutes(entriesBetween(data.timeEntries, row.from, row.to));
            return (
              <li key={row.key} className={`flex justify-between py-1.5 ${row.current ? "font-medium" : ""}`}>
                <span>{row.label}</span>
                <span className={minutes ? "" : "text-zinc-400"}>{minutes ? formatMinutes(minutes) : "—"}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
