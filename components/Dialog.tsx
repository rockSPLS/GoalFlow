"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Модальное окно на встроенном элементе <dialog>: браузер сам держит фокус внутри окна,
// закрывает его по Esc и затемняет фон. Клик по затемнённому фону тоже закрывает окно.
export function Dialog({
  open,
  onClose,
  label,
  children,
  size = "mt-[12vh] w-[min(36rem,calc(100%-2rem))] overflow-visible",
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  // Отступ сверху, ширина и прокрутка окна
  size?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Нажатие мыши пришлось на фон: окно закрывается, только если и нажали, и отпустили на фоне
  // (иначе выделение текста в поле, законченное над фоном, закрывало бы окно)
  const downOnBackdrop = useRef(false);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // Клик пришёлся на сам <dialog>, то есть на затемнённый фон вокруг содержимого
        if (e.target === e.currentTarget && downOnBackdrop.current) onClose();
      }}
      // overflow-visible (по умолчанию): выпадающие подсказки не обрезаются краем окна
      className={`mx-auto ${size} rounded-xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-black/40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100`}
    >
      {open && <div className="p-4">{children}</div>}
    </dialog>
  );
}
