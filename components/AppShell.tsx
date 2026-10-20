"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { unlockAudio } from "@/lib/sound";
import { showStopPrompt } from "@/lib/stop-prompt";
import { downloadText } from "@/lib/backup";
import type { Task, TaskFilter } from "@/lib/model";
import { brokenDataRaw, dismissNotice, IMPORT_NOTICE, startTimer, useStore } from "@/lib/store";
import { toDateInputValue } from "@/lib/time";
import { BackupControls } from "./BackupControls";
import { Dialog } from "./Dialog";
import { CopiesView, ImportUndoButtons } from "./ImportUndo";
import { KeyboardHelp, KeyboardHelpButton } from "./KeyboardHelp";
import { Wordmark } from "./Logo";
import { Palette } from "./Palette";
import { QuickAdd } from "./QuickAdd";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { changeStatus, stopAndAsk } from "./TimeParts";
import { StopPromptBanner, TimerEffects } from "./TimerBanners";
import { TimeView } from "./TimeView";
import { ToastBar } from "./ToastBar";
import { TaskEditor } from "./TaskEditor";
import { ALL_MODES, AllTasksView, GoalView, InboxView, ProjectView, type AllMode } from "./Views";
import { AppUiContext, defaultParentOf, type Toast } from "./app-ui";
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
  // «Все» с условиями фильтра (пустой фильтр — все задачи; готовые и сохранённые подборки — свои условия)
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
  const [toast, setToast] = useState<Toast | null>(null);
  // Задача, с которой последний раз работали клавишами Shift+X / Shift+S: после Shift+X её строка
  // уходит в выполненные и фокус теряется, а повторное нажатие должно вернуть её обратно
  const [lastTaskId, setLastTaskId] = useState<string | null>(null);
  // Окна: быстрый ввод (с начальным текстом из палитры), палитра команд, шпаргалка по клавишам
  const [quickAdd, setQuickAdd] = useState<{ text: string } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // Вид экрана «Все»: список, календарь или доска (Shift+V переключает по кругу)
  const [allMode, setAllMode] = useState<AllMode>("list");
  // Задача, чья карточка открыта в окне поверх экрана (доска, сообщение «добавлена в …»)
  const [windowTaskId, setWindowTaskId] = useState<string | null>(null);

  // Горячие клавиши. Ctrl+K (Cmd+K) работает везде, остальные — только вне полей ввода и окон.
  // Буквы — по физической клавише (event.code), поэтому работают и в русской раскладке; «?» — по символу.
  // Обработчик пересоздаётся при каждой отрисовке и всегда видит актуальное состояние.
  useEffect(() => {
    if (snapshot === null) return;
    const data = snapshot.data;
    const onKey = (e: KeyboardEvent) => {
      // Зажатая клавиша повторяет нажатие — повторы не считаем, иначе статус и таймер «мигали» бы
      if (e.defaultPrevented || e.isComposing || e.repeat) return;
      const target = e.target instanceof Element ? e.target : null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true']") != null;
      // Esc закрывает сообщение внизу экрана (окна закрываются сами — браузером). В поле ввода Esc
      // отменяет правку, и сообщение (например, с «Отменить») остаётся
      // Окно карточки открыто, только пока задача существует (её могли удалить, например, в другой вкладке)
      const windowOpen = paletteOpen || helpOpen || quickAdd !== null || data.tasks.some((t) => t.id === windowTaskId);
      if (e.key === "Escape" && toast && !typing && !windowOpen) {
        setToast(null);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.code === "KeyK") {
        e.preventDefault();
        // Поле карточки сохраняет правку при потере фокуса — снимаем фокус до того, как окно закроется
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        setQuickAdd(null);
        setHelpOpen(false);
        setWindowTaskId(null);
        setPaletteOpen(true);
        return;
      }
      if (typing || windowOpen || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (!e.shiftKey) return;
      // Текущая задача — строка с фокусом клавиатуры, иначе задача, с которой только что работали клавишами,
      // иначе задача с открытой карточкой (пока карточка на экране). «Только что работали» сбрасывается,
      // когда открывают другую карточку или переходят на другой экран.
      const row = document.activeElement?.closest("[data-task-id]");
      const focusedId = row instanceof HTMLElement ? row.dataset.taskId : undefined;
      const task =
        data.tasks.find((t) => t.id === focusedId) ??
        data.tasks.find((t) => t.id === lastTaskId) ??
        data.tasks.find((t) => isTaskOpen(openTask, t));
      const needTask = () => setToast({ kind: "info", text: "Сначала выберите задачу: откройте её карточку или перейдите к строке клавишей Tab." });
      switch (e.code) {
        case "KeyK":
          setPaletteOpen(true);
          break;
        case "KeyN":
          setQuickAdd({ text: "" });
          break;
        case "KeyV":
          if (selection.kind === "all") {
            const i = ALL_MODES.findIndex((m) => m.mode === allMode);
            setAllMode(ALL_MODES[(i + 1) % ALL_MODES.length].mode);
          } else setToast({ kind: "info", text: "Список, календарь и доска переключаются на экране «Все»." });
          break;
        case "KeyX":
          if (!task) needTask();
          else {
            const done = task.status === "done";
            changeStatus(task.id, done ? "todo" : "done");
            setLastTaskId(task.id);
            // Открытая карточка остаётся открытой и переезжает вместе с задачей (выполненные раскроются)
            setOpenTask((o) => (o && o.id === task.id ? { id: task.id, done: !done } : o));
            setToast({
              kind: "status",
              taskId: task.id,
              text: done ? `С задачи «${task.title}» снята отметка о выполнении.` : `Задача «${task.title}» отмечена выполненной.`,
              undoStatus: task.status,
            });
          }
          break;
        case "KeyS":
          if (!task) needTask();
          else if (data.timer?.taskId === task.id) {
            setLastTaskId(task.id);
            stopAndAsk();
          }
          else {
            // Нажатие клавиши — действие пользователя: после него браузер разрешит звук напоминания
            void unlockAudio();
            setLastTaskId(task.id);
            if (startTimer(task.id) === "done") {
              setToast({ kind: "info", text: `Задача «${task.title}» выполнена — таймер не запускается. Смените статус, чтобы снова работать над ней.` });
            } else showStopPrompt(null);
          }
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
    setLastTaskId(null);
    setWindowTaskId(null);
  };

  const appUi = {
    notify: setToast,
    openQuickAdd: (text = "") => setQuickAdd({ text }),
    openPalette: () => setPaletteOpen(true),
    openHelp: () => setHelpOpen(true),
    select,
  };

  const taskUi = {
    openTask,
    nav,
    // Сверяем и признак «выполнена»: после смены статуса карточка уже скрыта, и клик должен её открыть
    toggleTask: (task: Task) => {
      setOpenTask(isTaskOpen(openTask, task) ? null : { id: task.id, done: task.status === "done" });
      setLastTaskId(null);
    },
    // Переход к задаче: экран её проекта, цели или «Неразобранные», карточка открыта
    // Статус задачи с открытой карточкой поменяли не из неё (Shift+X, «Отменить») — карточка остаётся открытой
    syncOpen: (taskId: string, done: boolean) => setOpenTask((o) => (o && o.id === taskId ? { id: taskId, done } : o)),
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
      setLastTaskId(null);
      setOpenTask({ id: task.id, done: task.status === "done" });
      setNav({ id: task.id, seq: (nav?.seq ?? 0) + 1 });
    },
    // Карточка в окне. Если та же задача раскрыта в списке под окном — сворачиваем её там,
    // чтобы одну задачу не правили в двух карточках сразу
    openInWindow: (taskId: string) => {
      const task = data.tasks.find((t) => t.id === taskId);
      if (!task) {
        setToast({ kind: "info", text: "Этой задачи больше нет — её удалили." });
        return;
      }
      setWindowTaskId(taskId);
      setOpenTask((o) => (o && o.id === taskId ? null : o));
      setLastTaskId(null);
    },
  };
  const windowTask = windowTaskId === null ? undefined : data.tasks.find((t) => t.id === windowTaskId);
  // Доска на всю ширину основной области, остальные экраны — не шире 768 px
  const wide = current.kind === "all" && allMode === "board";

  return (
    // Любой клик или клавиша — действие пользователя: после него браузер разрешит звук напоминания
    <AppUiContext value={appUi}>
    <TaskUiContext value={taskUi}>
    <div className="flex min-h-full flex-1 flex-col md:flex-row" onPointerDownCapture={unlockAudio} onKeyDownCapture={unlockAudio}>
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 md:hidden dark:border-zinc-800">
        {/* Высота строки 36 px — как у кнопок справа, поэтому крупная надпись не делает полосу выше */}
        <Wordmark className="text-[28px] leading-9 font-semibold" />
        <div className="flex items-center gap-1">
          <KeyboardHelpButton />
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
          <Wordmark className="text-[28px] font-semibold" />
          <div className="flex items-center gap-1">
            <KeyboardHelpButton />
            <ThemeToggle />
          </div>
        </div>
        <div className="space-y-5">
          <Sidebar data={data} selection={current} onSelect={select} />
          <BackupControls copies={copies} copiesOpen={current.kind === "copies"} onOpenCopies={() => select({ kind: "copies" })} />
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className={`mx-auto space-y-4 ${wide ? "" : "max-w-3xl"}`}>
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
          {/* Пока открыта карточка в окне, уведомление показывается в окне */}
          {windowTask === undefined && <StopPromptBanner data={data} />}
          {goal ? (
            <GoalView key={goal.id} data={data} goal={goal} onSelect={select} />
          ) : project ? (
            <ProjectView key={project.id} data={data} project={project} onSelect={select} />
          ) : current.kind === "time" ? (
            <TimeView data={data} />
          ) : current.kind === "all" ? (
            <AllTasksView
              data={data}
              filter={current.filter}
              onFilter={(filter) => setSelection({ kind: "all", filter })}
              mode={allMode}
              onMode={setAllMode}
            />
          ) : current.kind === "copies" ? (
            // key: когда копии меняются, экран начинается заново — старое сообщение об ошибке не остаётся
            <CopiesView key={`${copies.beforeImport}|${copies.broken?.at}`} copies={copies} />
          ) : (
            <InboxView data={data} />
          )}
        </div>
      </main>

      <ToastBar toast={toast} />
      <Dialog open={quickAdd !== null} onClose={() => setQuickAdd(null)} label="Быстрый ввод задачи">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Новая задача</h2>
          <QuickAdd
            data={data}
            defaultParent={defaultParentOf(current)}
            placeholder="Название и метки — Enter, чтобы добавить"
            autoFocus
            initialText={quickAdd?.text ?? ""}
            onAdded={() => setQuickAdd(null)}
            alwaysNotify
          />
        </div>
      </Dialog>
      <Dialog open={paletteOpen} onClose={() => setPaletteOpen(false)} label="Палитра команд">
        <Palette
          data={data}
          onClose={() => setPaletteOpen(false)}
          onSelect={select}
          onGoToTask={taskUi.goToTask}
          onQuickAdd={(text) => setQuickAdd({ text })}
          onHelp={() => setHelpOpen(true)}
        />
      </Dialog>
      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} label="Горячие клавиши">
        <KeyboardHelp />
      </Dialog>
      {/* Карточка задачи в окне. Окно закрывается само, если задачу удалили.
          Связанная задача открывается в этом же окне, а не переходом на её экран. */}
      <Dialog
        open={windowTask !== undefined}
        onClose={() => setWindowTaskId(null)}
        label={windowTask ? `Задача «${windowTask.title}»` : "Задача"}
        size="mt-[6vh] max-h-[88vh] w-[min(42rem,calc(100%-2rem))] overflow-y-auto"
      >
        {windowTask && (
          <TaskUiContext value={{ ...taskUi, goToTask: taskUi.openInWindow }}>
            {/* Уведомление «таймер остановлен» / «сменить статус?» показываем в окне: страница под окном недоступна */}
            <div className="space-y-4">
              <StopPromptBanner data={data} />
              <TaskEditor key={windowTask.id} task={windowTask} data={data} onClose={() => setWindowTaskId(null)} inWindow />
            </div>
          </TaskUiContext>
        )}
      </Dialog>
    </div>
    </TaskUiContext>
    </AppUiContext>
  );
}
