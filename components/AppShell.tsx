"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { unlockAudio } from "@/lib/sound";
import { downloadText } from "@/lib/backup";
import type { Task, TaskFilter } from "@/lib/model";
import { brokenDataRaw, dismissNotice, IMPORT_NOTICE, useStore } from "@/lib/store";
import { toDateInputValue } from "@/lib/time";
import { BackupControls } from "./BackupControls";
import { CopiesView, ImportUndoButtons } from "./ImportUndo";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { StopPromptBanner, TimerEffects } from "./TimerBanners";
import { TimeView } from "./TimeView";
import { AllTasksView, GoalView, InboxView, ProjectView } from "./Views";
import { isTaskOpen, TaskUiContext, type OpenTask, type TaskNav } from "./task-ui";

const noticeButtonClass =
  "rounded-md border border-amber-400 px-3 py-1 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900";

// Повреждённые данные скачиваются как есть: восстановить их нельзя, но файл можно поправить вручную
function downloadBroken(key: string) {
  const raw = brokenDataRaw(key);
  if (raw !== null) downloadText(`goalflow-damaged-${toDateInputValue(new Date())}.json`, raw);
}

// Что открыто в основной области
export type Selection =
  | { kind: "inbox" }
  // «Все» с условиями фильтра (пустой фильтр — все задачи; готовые и сохранённые виды — свои условия)
  | { kind: "all"; filter: TaskFilter }
  | { kind: "copies" }
  | { kind: "time" }
  | { kind: "goal"; id: string }
  | { kind: "project"; id: string };

export function AppShell() {
  const snapshot = useStore();
  const [selection, setSelection] = useState<Selection>({ kind: "inbox" });
  const [menuOpen, setMenuOpen] = useState(false);
  const [openTask, setOpenTask] = useState<OpenTask>(null);
  const [nav, setNav] = useState<TaskNav>(null);

  // На сервере и до чтения localStorage данных ещё нет
  if (snapshot === null) {
    return <p className="p-6 text-sm text-zinc-500">Загрузка…</p>;
  }
  const { data, notice, locked, brokenKey, copies } = snapshot;

  // Если открытую цель или проект удалили (например, в другой вкладке) — показываем «Неразобранные»
  const goal = selection.kind === "goal" ? data.goals.find((g) => g.id === selection.id) : undefined;
  const project = selection.kind === "project" ? data.projects.find((p) => p.id === selection.id) : undefined;
  const current: Selection = selection.kind === "goal" || selection.kind === "project" ? (goal || project ? selection : { kind: "inbox" }) : selection;

  const select = (next: Selection) => {
    setSelection(next);
    setMenuOpen(false);
    setOpenTask(null);
    setNav(null);
  };

  const taskUi = {
    openTask,
    nav,
    // Сверяем и признак «выполнена»: после смены статуса карточка уже скрыта, и клик должен её открыть
    toggleTask: (task: Task) =>
      setOpenTask(isTaskOpen(openTask, task) ? null : { id: task.id, done: task.status === "done" }),
    // Переход к задаче: экран её проекта, цели или «Неразобранные», карточка открыта
    goToTask: (taskId: string) => {
      const task = data.tasks.find((t) => t.id === taskId);
      if (!task) return;
      setSelection(
        task.projectId !== null
          ? { kind: "project", id: task.projectId }
          : task.goalId !== null
            ? { kind: "goal", id: task.goalId }
            : { kind: "inbox" },
      );
      setMenuOpen(false);
      setOpenTask({ id: task.id, done: task.status === "done" });
      setNav({ id: task.id, seq: (nav?.seq ?? 0) + 1 });
    },
  };

  return (
    // Любой клик или клавиша — действие пользователя: после него браузер разрешит звук напоминания
    <TaskUiContext value={taskUi}>
    <div className="flex min-h-full flex-1 flex-col md:flex-row" onPointerDownCapture={unlockAudio} onKeyDownCapture={unlockAudio}>
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 md:hidden dark:border-zinc-800">
        <span className="font-semibold">GoalFlow</span>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Скрыть меню" : "Показать меню"}
            className="rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <aside
        className={`${menuOpen ? "block" : "hidden"} border-b border-zinc-200 bg-zinc-50 p-4 md:block md:w-72 md:shrink-0 md:border-r md:border-b-0 dark:border-zinc-800 dark:bg-zinc-950`}
      >
        <div className="mb-4 hidden items-center justify-between pl-2 md:flex">
          <p className="text-lg font-semibold">GoalFlow</p>
          <ThemeToggle />
        </div>
        <div className="space-y-5">
          <Sidebar data={data} selection={current} onSelect={select} />
          <BackupControls copies={copies} copiesOpen={current.kind === "copies"} onOpenCopies={() => select({ kind: "copies" })} />
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-3xl space-y-4">
          {notice && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <div className="flex-1 space-y-2">
                <p>{notice}</p>
                {notice === IMPORT_NOTICE && copies.beforeImport !== null && (
                  <div className="flex flex-wrap gap-2">
                    <ImportUndoButtons className={noticeButtonClass} />
                  </div>
                )}
                {brokenKey !== null && (
                  <button type="button" onClick={() => downloadBroken(brokenKey)} className={noticeButtonClass}>
                    Скачать повреждённые данные
                  </button>
                )}
              </div>
              {/* Пока запись запрещена, сообщение не скрывается — иначе легко забыть, что ничего не сохраняется */}
              {!locked && (
                <button type="button" onClick={dismissNotice} aria-label="Скрыть сообщение" className="rounded p-1 hover:bg-amber-100 dark:hover:bg-amber-900">
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          <TimerEffects data={data} />
          <StopPromptBanner data={data} />
          {goal ? (
            <GoalView key={goal.id} data={data} goal={goal} onSelect={select} />
          ) : project ? (
            <ProjectView key={project.id} data={data} project={project} onSelect={select} />
          ) : current.kind === "time" ? (
            <TimeView data={data} />
          ) : current.kind === "all" ? (
            <AllTasksView data={data} filter={current.filter} onFilter={(filter) => setSelection({ kind: "all", filter })} />
          ) : current.kind === "copies" ? (
            // key: когда копии меняются, экран начинается заново — старое сообщение об ошибке не остаётся
            <CopiesView key={`${copies.beforeImport}|${copies.broken?.at}`} copies={copies} />
          ) : (
            <InboxView data={data} />
          )}
        </div>
      </main>
    </div>
    </TaskUiContext>
  );
}
