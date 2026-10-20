"use client";

import { Keyboard } from "lucide-react";
import { useAppUi } from "./app-ui";

// Шпаргалка по горячим клавишам (открывается клавишей «?», кнопкой с клавиатурой или из палитры)

export const SHORTCUTS: [string, string][] = [
  ["Ctrl+K или Shift+K", "Палитра команд: найти задачу, перейти, выполнить действие"],
  ["Shift+N", "Быстрый ввод задачи"],
  ["Shift+V", "Список / календарь / доска на экране «Все»"],
  ["Shift+X", "Отметить выполненной (и обратно) — текущую задачу"],
  ["Shift+S", "Запустить или остановить таймер — текущей задачи"],
  ["Tab, ↑ ↓", "Перейти по задачам в списке"],
  ["Enter", "Открыть или закрыть карточку задачи"],
  ["Esc", "Закрыть окно, подсказки или сообщение внизу"],
  ["?", "Эта шпаргалка"],
];

export function KeyboardHelp() {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Горячие клавиши</h2>
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2.5 text-[15px] leading-snug">
        {SHORTCUTS.map(([keys, what]) => (
          <div key={keys} className="contents">
            <dt>
              <kbd className="rounded border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 font-mono text-[13px] whitespace-nowrap text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">{keys}</kbd>
            </dt>
            <dd className="text-zinc-800 dark:text-zinc-200">{what}</dd>
          </div>
        ))}
      </dl>
      {/* Пояснения — отдельными пунктами и не мельче основного текста: сплошной мелкий абзац читался тяжело */}
      <ul className="list-disc space-y-1.5 border-t border-zinc-200 pt-3 pl-5 text-sm leading-relaxed text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
        <li>
          Текущая задача — строка, на которой фокус. Если фокуса на строке нет — задача, с которой только что работали через
          Shift+X или Shift+S, иначе задача с открытой карточкой.
        </li>
        <li>Клавиши с Shift не срабатывают, пока курсор в поле ввода.</li>
        <li>
          Клавиши с буквами работают в любой раскладке. «?» нажимается там, где он есть в раскладке: Shift+7 в русской,
          Shift+/ в английской.
        </li>
      </ul>
    </div>
  );
}

// Кнопка шпаргалки — рядом с переключателем темы
export function KeyboardHelpButton() {
  const { openHelp } = useAppUi();
  return (
    <button
      type="button"
      onClick={openHelp}
      aria-label="Горячие клавиши"
      title="Горячие клавиши (?)"
      className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      <Keyboard size={18} aria-hidden="true" />
    </button>
  );
}
