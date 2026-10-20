"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { changeStatus } from "./TimeParts";
import { useAppUi, type Toast } from "./app-ui";
import { useTaskUi } from "./task-ui";

// Сообщение внизу экрана: куда добавлена задача (название открывает её карточку в окне, пространство — переход туда),
// отметка выполнения (с «Отменить»)
// или просто текст. Одно сообщение за раз; новое заменяет старое, крестик закрывает.
// Сообщение исчезает само на втором действии в другом месте страницы — клике или переходе по Tab.
// Не на первом: первым кликом часто переходят к задаче, а сообщение ещё нужно, например, чтобы нажать «Отменить».
export function ToastBar({ toast }: { toast: Toast | null }) {
  const { notify, select } = useAppUi();
  const { openInWindow, syncOpen } = useTaskUi();
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!toast) return;
    // Новое сообщение — отсчёт заново. Действие, которое его вызвало, уже прошло и не считается
    let actions = 0;
    const onAction = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Tab") return;
      if (e.target instanceof Node && boxRef.current?.contains(e.target)) return;
      actions += 1;
      if (actions >= 2) notify(null);
    };
    document.addEventListener("pointerdown", onAction, true);
    document.addEventListener("keydown", onAction, true);
    return () => {
      document.removeEventListener("pointerdown", onAction, true);
      document.removeEventListener("keydown", onAction, true);
    };
  }, [toast, notify]);
  const link = "font-medium underline decoration-zinc-400 underline-offset-2 hover:decoration-current";
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
      {toast && (
        <div ref={boxRef} className="pointer-events-auto flex max-w-xl items-start gap-3 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
          <p className="min-w-0 flex-1">
            {toast.kind === "added" && (
              <>
                Задача{" "}
                <button type="button" className={link} onClick={() => { notify(null); openInWindow(toast.taskId); }}>
                  «{toast.title}»
                </button>{" "}
                добавлена в{" "}
                <button type="button" className={link} onClick={() => { notify(null); select(toast.space); }}>
                  «{toast.spaceLabel}»
                </button>
              </>
            )}
            {toast.kind === "status" && (
              <>
                {toast.text}{" "}
                <button
                  type="button"
                  className={link}
                  onClick={() => {
                    notify(null);
                    changeStatus(toast.taskId, toast.undoStatus);
                    syncOpen(toast.taskId, toast.undoStatus === "done");
                  }}
                >
                  Отменить
                </button>
              </>
            )}
            {toast.kind === "info" && toast.text}
          </p>
          <button type="button" onClick={() => notify(null)} aria-label="Закрыть сообщение" className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
