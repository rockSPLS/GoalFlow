"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { AppData, TimeEntry } from "@/lib/model";
import { exportTimeCsv } from "@/lib/backup";
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
  toDateInputValue,
} from "@/lib/time";

// Экран «Затраты времени»: итоги за сегодня и за выбранный период — неделю (с понедельника), месяц
// (с переходом к прошлым периодам) или свой период «с … по …». Разбивка по целям и по дням или неделям.
// Таблицу записей (CSV) можно выгрузить за выбранный период или за всё время.
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

type Mode = "week" | "month" | "custom";

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

// Недели (с понедельника), обрезанные по границам промежутка [from, to)
function weekRows(from: Date, to: Date, now: Date): Row[] {
  const today = startOfDay(now);
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
  return rows;
}

// Дата из поля «ГГГГ-ММ-ДД» по местному времени (null — поле пустое или дата неверная).
// Год меньше 1000 — недописанный: поле даты сообщает значение после каждой цифры года (0002, 0020, 0202…)
function parseDay(value: string): Date | null {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d || y < 1000) return null;
  const date = new Date(y, m - 1, d);
  return date.getMonth() === m - 1 ? date : null;
}

// До месяца — разбивка по дням, дольше — по неделям
const CUSTOM_DAY_ROWS = 31;
// Свой период — не длиннее двух лет: иначе разбивка по неделям растянулась бы на сотни строк
const CUSTOM_MAX_DAYS = 2 * 366;

// Свой период «с … по …» (обе даты включительно). null — даты не заданы, «с» позже «по» или период длиннее двух лет
function customPeriod(fromValue: string, toValue: string, now: Date) {
  const from = parseDay(fromValue);
  const last = parseDay(toValue);
  if (!from || !last || from > last) return null;
  const to = addDays(last, 1);
  const today = startOfDay(now);
  const days = Math.round((to.getTime() - from.getTime()) / 86400000);
  if (days > CUSTOM_MAX_DAYS) return null;
  const rows: Row[] =
    days <= CUSTOM_DAY_ROWS
      ? Array.from({ length: days }, (_, i) => {
          const day = addDays(from, i);
          return { key: day.toISOString(), label: formatWeekday(day), from: day, to: addDays(day, 1), current: day.getTime() === today.getTime() };
        })
      : weekRows(from, to, now);
  return { from, to, rows, title: rangeLabel(from, to, now), rowsTitle: days <= CUSTOM_DAY_ROWS ? "По дням" : "По неделям" };
}

function periodOf(now: Date, mode: "week" | "month", offset: number) {
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
  const rows = weekRows(from, to, now);
  const title = offset === 0 ? "Этот месяц" : formatMonth(from);
  return { from, to, rows, title, rowsTitle: "По неделям" };
}

// Размеры кнопок — не меньше 44 px по высоте, чтобы попадать пальцем на телефоне
const toggleClass = (active: boolean) =>
  `min-h-11 rounded-md px-3 py-2 text-sm ${active ? "bg-zinc-200 font-medium dark:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"}`;

const csvClass =
  "flex min-h-11 items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

const dateClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

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
  // Свой период: по умолчанию — с начала текущего месяца по сегодня
  const [customFrom, setCustomFrom] = useState(() => toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [customTo, setCustomTo] = useState(() => toDateInputValue(now));
  const period = mode === "custom" ? customPeriod(customFrom, customTo, now) : periodOf(now, mode, offset);
  const periodEntries = period ? entriesBetween(data.timeEntries, period.from, period.to) : [];
  const switchMode = (next: Mode) => {
    setMode(next);
    setOffset(0);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Затраты времени</h1>
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
            <button type="button" aria-pressed={mode === "custom"} onClick={() => switchMode("custom")} className={toggleClass(mode === "custom")}>
              Свой период
            </button>
          </div>
          {mode === "custom" ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
              <label className="flex items-center gap-1.5">
                с
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={dateClass} />
              </label>
              <label className="flex items-center gap-1.5">
                по
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={dateClass} />
              </label>
            </div>
          ) : (
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
          )}
        </div>
        {/* Выгрузка записей времени для Excel — за выбранный период или за всё время */}
        <div className="flex flex-wrap gap-2">
          {period !== null && (
            <button type="button" onClick={() => exportTimeCsv(data, { from: period.from, to: period.to })} className={csvClass}>
              <Download size={16} aria-hidden="true" />
              Таблица за этот период (CSV)
            </button>
          )}
          <button type="button" onClick={() => exportTimeCsv(data)} className={csvClass}>
            <Download size={16} aria-hidden="true" />
            Таблица за всё время (CSV)
          </button>
        </div>
        {period === null ? (
          <p className="text-sm text-red-600 dark:text-red-400">Укажите обе даты; дата «с» не может быть позже даты «по», период — не длиннее двух лет.</p>
        ) : (
          <>
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
          </>
        )}
      </section>
    </div>
  );
}
