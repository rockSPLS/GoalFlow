"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { useNow } from "@/lib/clock";
import { REMINDER_REPEAT_MS, STATUSES, STATUS_LABELS, type AppData, type Timer } from "@/lib/model";
import { playChime, unlockAudio } from "@/lib/sound";
import { showStopPrompt, useStopPrompt } from "@/lib/stop-prompt";
import { snoozeTimer } from "@/lib/store";
import { changeStatus, stopAndAsk } from "./TimeParts";
import { formatElapsed, formatMinutes, formatTime } from "@/lib/time";

// Всё, что связано с идущим таймером на уровне приложения:
// заголовок вкладки, напоминание о забытом таймере, выбор статуса после остановки

const APP_TITLE = "GoalFlow";

function hoursText(ms: number) {
  const hours = Math.floor(ms / 3_600_000);
  return hours >= 1 ? `${hours} ч` : `${Math.floor(ms / 60_000)} мин`;
}

export function TimerEffects({ data }: { data: AppData }) {
  const timer = data.timer;
  if (timer === null) return <TitleReset />;
  const task = data.tasks.find((t) => t.id === timer.taskId);
  return <RunningTimer timer={timer} taskTitle={task?.title ?? ""} />;
}

function TitleReset() {
  useEffect(() => {
    document.title = APP_TITLE;
  }, []);
  return null;
}

function RunningTimer({ timer, taskTitle }: { timer: Timer; taskTitle: string }) {
  const now = useNow();
  const elapsed = now - new Date(timer.startedAt).getTime();
  const reminding = now >= new Date(timer.remindAt).getTime();

  // Заголовок вкладки: идущее время (без секунд — меняется раз в минуту) или колокольчик напоминания
  const minutesTitle = formatElapsed(elapsed).slice(0, -3);
  const title = reminding
    ? `🔔 Таймер идёт ${hoursText(elapsed)} — ${APP_TITLE}`
    : `▶ ${minutesTitle} · ${taskTitle} — ${APP_TITLE}`;
  useEffect(() => {
    document.title = title;
  }, [title]);
  useEffect(() => () => void (document.title = APP_TITLE), []);

  if (!reminding) return null;
  // key: после «Работа продолжается» — новое напоминание со своим состоянием звука
  return <ReminderBanner key={timer.remindAt} timer={timer} taskTitle={taskTitle} elapsed={elapsed} />;
}

const buttonClass =
  "rounded-md border border-amber-400 px-3 py-1.5 text-sm hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900";

function ReminderBanner({ timer, taskTitle, elapsed }: { timer: Timer; taskTitle: string; elapsed: number }) {
  const [muted, setMuted] = useState(false);
  const [askEnd, setAskEnd] = useState(false);
  const [endTime, setEndTime] = useState(() => formatTime(new Date(timer.remindAt)));
  const [error, setError] = useState<string | null>(null);

  // Сигнал сразу и повтор каждые 5 минут, пока нет ответа.
  // Если браузер ещё не разрешил звук (страницу только что открыли), сигнал прозвучит
  // при первом клике или нажатии клавиши.
  useEffect(() => {
    if (muted) return;
    const id = setInterval(playChime, REMINDER_REPEAT_MS);
    if (playChime()) return () => clearInterval(id);
    const onFirstAction = () => void unlockAudio().then(playChime);
    document.addEventListener("pointerdown", onFirstAction, { once: true, capture: true });
    document.addEventListener("keydown", onFirstAction, { once: true, capture: true });
    return () => {
      clearInterval(id);
      document.removeEventListener("pointerdown", onFirstAction, { capture: true });
      document.removeEventListener("keydown", onFirstAction, { capture: true });
    };
  }, [muted]);

  const stopAt = (end: Date) => stopAndAsk(end);

  // Время окончания — ближайший прошедший момент с этим временем суток после старта таймера
  const stopAtTime = () => {
    const [h, m] = endTime.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) {
      setError("Укажите время окончания.");
      return;
    }
    const now = new Date();
    let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    // Это время сегодня ещё не наступило — значит, вчера (через календарь, а не «минус 24 ч»:
    // в день перевода часов сутки не равны 24 ч)
    if (end.getTime() > now.getTime()) end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, h, m);
    if (end.getTime() <= new Date(timer.startedAt).getTime()) {
      setError(`Таймер запущен в ${formatTime(new Date(timer.startedAt))} — окончание должно быть позже.`);
      return;
    }
    stopAt(end);
  };

  return (
    <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      {/* Для экранного диктора — неизменный текст: видимый ниже меняется каждую минуту и зачитывался бы заново */}
      <p role="alert" className="sr-only">
        Напоминание: таймер задачи «{taskTitle}» всё ещё идёт.
      </p>
      <div className="flex items-start gap-2">
        <Bell size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p className="flex-1">
          Таймер задачи «{taskTitle}» идёт уже {formatMinutes(Math.floor(elapsed / 60_000))} (с {formatTime(new Date(timer.startedAt))}). Работа продолжается?
        </p>
        <button
          type="button"
          onClick={() => setMuted(!muted)}
          aria-label={muted ? "Включить звук напоминания" : "Выключить звук напоминания"}
          title={muted ? "Включить звук" : "Без звука"}
          className="rounded p-1 hover:bg-amber-100 dark:hover:bg-amber-900"
        >
          {muted ? <BellOff size={16} aria-hidden="true" /> : <Bell size={16} aria-hidden="true" />}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={snoozeTimer} className={buttonClass}>
          Работа продолжается
        </button>
        <button type="button" onClick={() => stopAt(new Date())} className={buttonClass}>
          Остановить сейчас
        </button>
        <button type="button" onClick={() => setAskEnd(true)} className={buttonClass} aria-expanded={askEnd}>
          Указать время окончания
        </button>
      </div>
      {askEnd && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs">
            Время окончания
            <input
              type="time"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                setError(null);
              }}
              className="rounded-md border border-amber-400 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-amber-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <button type="button" onClick={stopAtTime} className={buttonClass}>
            Остановить с этим временем
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}

// После остановки таймера: «сменить статус?» — ничего не меняется без выбора пользователя
export function StopPromptBanner({ data }: { data: AppData }) {
  const prompt = useStopPrompt();
  if (prompt === null) return null;
  const task = data.tasks.find((t) => t.id === prompt.taskId);
  if (!task) return null;
  const close = () => showStopPrompt(null);
  const recorded = prompt.minutes > 0 ? `записано ${formatMinutes(prompt.minutes)}` : "время не записано — меньше минуты";
  const ask = prompt.kind === "ask";
  return (
    <div role="status" className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-2">
        <p className="flex-1">
          {ask
            ? `Таймер остановлен: «${task.title}», ${recorded}. Сменить статус задачи? Сейчас — «${STATUS_LABELS[task.status]}».`
            : `Статус задачи «${task.title}» изменён на «${STATUS_LABELS[task.status]}», поэтому таймер остановлен: ${recorded}.`}
        </p>
        <button
          type="button"
          onClick={close}
          aria-label={ask ? "Оставить статус как есть" : "Скрыть уведомление"}
          className="rounded p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {ask && <div className="flex flex-wrap gap-2">
        {STATUSES.filter((s) => s !== task.status).map((s) => (
          <button
            key={s}
            type="button"
            // changeStatus сам уберёт этот вопрос или покажет уведомление, если таймер успели запустить снова
            onClick={() => changeStatus(task.id, s)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
        <button type="button" onClick={close} className="rounded-md px-3 py-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          Оставить как есть
        </button>
      </div>}
    </div>
  );
}
