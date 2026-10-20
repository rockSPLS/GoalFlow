"use client";

import { Moon, Sun } from "lucide-react";
import { useLayoutEffect, useSyncExternalStore } from "react";
import { THEME_KEY } from "@/lib/theme";

// Переключатель светлой и тёмной темы. Тема хранится в атрибуте data-theme
// на <html> (его до первой отрисовки выставляет скрипт в app/layout.tsx)
// и запоминается в localStorage.

type Theme = "light" | "dark";

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

// Тему переключили в другой вкладке — применяем её и здесь
function onStorage(event: StorageEvent) {
  if (event.key === THEME_KEY && (event.newValue === "dark" || event.newValue === "light")) {
    document.documentElement.dataset.theme = event.newValue;
  }
}

// Подписка на изменения атрибута: все кнопки темы показывают актуальное состояние
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  window.addEventListener("storage", onStorage);
  return () => {
    observer.disconnect();
    window.removeEventListener("storage", onStorage);
  };
}

// Переключить тему (кнопкой или из палитры команд)
export function toggleTheme() {
  const next: Theme = readTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // localStorage недоступен (например, приватный режим) — тема просто не запомнится
  }
}

export function ThemeToggle() {
  // Серверный снимок обязателен для useSyncExternalStore. Сейчас кнопка рисуется только
  // в браузере (внутри AppShell после загрузки данных), но если её перенесут в серверную
  // разметку, светлая тема совпадёт с разметкой по умолчанию.
  const theme = useSyncExternalStore(subscribe, readTheme, (): Theme => "light");
  const isDark = theme === "dark";

  // В режиме разработки React (Strict Mode) при повторном монтировании сбрасывает
  // атрибуты <html> к значениям из разметки и стирает тему, выставленную скриптом.
  // Применяем сохранённую тему ещё раз до отрисовки; в production это ничего не меняет.
  useLayoutEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") document.documentElement.dataset.theme = saved;
    } catch {
      // localStorage недоступен — остаётся тема по умолчанию
    }
  }, []);

  // Подпись говорит, что сделает нажатие
  const label = isDark ? "Включить светлую тему" : "Включить тёмную тему";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
