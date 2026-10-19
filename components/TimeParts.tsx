"use client";

import { useState } from "react";
import { Play, Square, Trash } from "lucide-react";
import { useNow } from "@/lib/clock";
import { ENTRY_MAX_MINUTES, type AppData, type Status, type Task } from "@/lib/model";
import { unlockAudio } from "@/lib/sound";
import { currentStopPrompt, showStopPrompt } from "@/lib/stop-prompt";
import {
  addManualEntry,
  deleteEntry,
  setEntryMinutes,
  setTaskStatus,
  startTimer,
  stopTimer,
} from "@/lib/store";
import { formatDay, formatElapsed, formatMinutes, formatTime, sumMinutes, toDateInputValue } from "@/lib/time";

// Элементы учёта времени в задаче: кнопка таймера, идущее время, записи и ручной ввод

// Ручная остановка: после неё предлагаем сменить статус
export function stopAndAsk(end?: Date) {
  const stopped = stopTimer(end);
  if (stopped) showStopPrompt({ kind: "ask", ...stopped });
}

// Смена статуса из интерфейса: если при этом остановился таймер — сообщаем об этом.
// Если для этой задачи висел вопрос «сменить статус?», он уже решён — убираем его.
export function changeStatus(taskId: string, status: Status) {
  const stopped = setTaskStatus(taskId, status);
  if (stopped) showStopPrompt({ kind: "status", ...stopped });
  else if (currentStopPrompt()?.taskId === taskId) showStopPrompt(null);
}

export function TimerButton({ task, running, onBlocked }: { task: Task; running: boolean; onBlocked: () => void }) {
  const label = running ? `Остановить таймер: ${task.title}` : `Запустить таймер: ${task.title}`;
  return (
    <button
      type="button"
      onClick={() => {
        // Клик — действие пользователя, после него браузер разрешит звук напоминания
        void unlockAudio();
        if (running) {
          stopAndAsk();
          return;
        }
        if (startTimer(task.id) === "done") {
          onBlocked();
          return;
        }
        // Уведомление о прошлой остановке больше не актуально
        showStopPrompt(null);
      }}
      aria-label={label}
      title={running ? "Остановить таймер" : "Запустить таймер"}
      className={`shrink-0 rounded-full p-1.5 ${
        running
          ? "bg-indigo-500 text-white hover:bg-indigo-600"
          : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-200 dark:hover:bg-indigo-800"
      }`}
    >
      {running ? <Square size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
    </button>
  );
}

// Идущее время таймера, обновляется каждую секунду
export function RunningTime({ startedAt, className }: { startedAt: string; className?: string }) {
  const now = useNow();
  return (
    <span className={`tabular-nums ${className ?? ""}`}>{formatElapsed(now - new Date(startedAt).getTime())}</span>
  );
}

const fieldClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

// Блок «Затраты времени» в карточке задачи: итог, записи, ручное добавление
export function TaskTimeSection({ task, data }: { task: Task; data: AppData }) {
  const entries = data.timeEntries.filter((e) => e.taskId === task.id).sort((a, b) => b.start.localeCompare(a.start));
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const h = Number(hours) || 0;
    const m = Number(minutes) || 0;
    if (h < 0 || m < 0) {
      setError("Время не может быть отрицательным.");
      return;
    }
    const total = h * 60 + m;
    if (!Number.isFinite(total) || total < 1) {
      setError("Укажите время: часы и/или минуты.");
      return;
    }
    if (total > ENTRY_MAX_MINUTES) {
      setError("Одна запись — не больше 24 часов.");
      return;
    }
    const [year, month, day] = date.split("-").map(Number);
    if (!year || !month || !day) {
      setError("Укажите дату.");
      return;
    }
    if (date > toDateInputValue(new Date())) {
      setError("Нельзя записать время на будущий день.");
      return;
    }
    // День выбранной даты, полдень — чтобы запись не «переехала» на соседний день из-за часового пояса
    addManualEntry(task.id, total, new Date(year, month - 1, day, 12, 0));
    setHours("");
    setMinutes("");
    setError(null);
  };

  return (
    <section className="space-y-2">
      <h3 className="text-xs text-zinc-500">
        Затраты времени: <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatMinutes(sumMinutes(entries))}</span>
      </h3>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Часы
          <input type="number" min={0} max={24} inputMode="numeric" value={hours} onChange={(e) => { setHours(e.target.value); setError(null); }} className={`${fieldClass} w-20`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Минуты
          <input type="number" min={0} max={59} inputMode="numeric" value={minutes} onChange={(e) => { setMinutes(e.target.value); setError(null); }} className={`${fieldClass} w-20`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Дата
          <input type="date" value={date} max={toDateInputValue(new Date())} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
        </label>
        <button type="button" onClick={add} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
          Добавить время
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {entries.length > 0 && (
        <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          {entries.map((entry) => {
            const start = new Date(entry.start);
            return (
              <li key={entry.id} className="flex items-center gap-2 py-1.5">
                <span className="w-32 shrink-0 text-zinc-500">
                  {formatDay(start)}
                  {entry.source === "timer" ? `, ${formatTime(start)}` : ""}
                </span>
                <label className="flex items-center gap-1">
                  <span className="sr-only">Длительность, минут</span>
                  <input
                    // Ключ с минутами: если запись изменили в другой вкладке, поле покажет новое значение
                    key={`${entry.id}-${entry.minutes}`}
                    type="number"
                    min={1}
                    max={ENTRY_MAX_MINUTES}
                    defaultValue={entry.minutes}
                    onBlur={(e) => {
                      const value = Number(e.target.value);
                      if (value >= 1 && value <= ENTRY_MAX_MINUTES) setEntryMinutes(entry.id, value);
                      else e.target.value = String(entry.minutes);
                    }}
                    className={`${fieldClass} w-20 py-1`}
                  />
                  <span className="text-zinc-500">мин</span>
                </label>
                <span className="text-xs text-zinc-400">{entry.source === "timer" ? "таймер" : "вручную"}</span>
                <button
                  type="button"
                  onClick={() => deleteEntry(entry.id)}
                  aria-label={`Удалить запись: ${formatDay(start)}, ${formatMinutes(entry.minutes)}`}
                  className="ml-auto rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                >
                  <Trash size={14} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
