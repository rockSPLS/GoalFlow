"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Clock, Download, Folder, Inbox, Keyboard, List, ListFilter, Moon, Plus, Search, Target } from "lucide-react";
import type { AppData } from "@/lib/model";
import { exportJson } from "@/lib/backup";
import { EMPTY_FILTER, READY_VIEWS } from "@/lib/filters";
import { addGoal, currentData } from "@/lib/store";
import { spaceOf } from "./app-ui";
import { pathOf } from "./task-ui";
import { toggleTheme } from "./ThemeToggle";
import type { Selection } from "./AppShell";

// Палитра команд (Ctrl+K или Shift+K): одно поле поиска — задачи по названию (открыть карточку),
// пространства (перейти) и действия (выполнить). ↑↓ — выбор, Enter — выполнить, Esc — закрыть.
// Первый вариант выбран сразу: Enter выполняет то, что подсвечено и видно в списке.

type Group = "Задачи" | "Пространства" | "Действия";
type Item = { key: string; group: Group; label: string; hint?: string; icon: ReactNode; run: () => void };

const TASKS_SHOWN = 8;
const lower = (text: string) => text.toLocaleLowerCase("ru");
const icon = (Icon: typeof Search) => <Icon size={16} className="shrink-0 text-zinc-400" aria-hidden="true" />;

export function Palette({
  data,
  onClose,
  onSelect,
  onGoToTask,
  onQuickAdd,
  onHelp,
}: {
  data: AppData;
  onClose: () => void;
  onSelect: (s: Selection) => void;
  onGoToTask: (taskId: string) => void;
  onQuickAdd: (text: string) => void;
  onHelp: () => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const q = lower(query.trim());
  const match = (text: string) => lower(text).includes(q);

  const tasks: Item[] = q
    ? data.tasks
        .filter((t) => match(t.title))
        // Сначала невыполненные
        .sort((a, b) => Number(a.status === "done") - Number(b.status === "done"))
        .slice(0, TASKS_SHOWN)
        .map((t) => ({
          key: `task:${t.id}`,
          group: "Задачи",
          label: t.title,
          hint: pathOf(data, t) + (t.status === "done" ? " · выполнена" : ""),
          icon: icon(Search),
          run: () => onGoToTask(t.id),
        }))
    : [];

  const space: Group = "Пространства";
  const action: Group = "Действия";
  const spaceItems: Item[] = [
    { key: "inbox", group: space, label: "Неразобранные", icon: icon(Inbox), run: () => onSelect({ kind: "inbox" }) },
    { key: "all", group: space, label: "Все задачи", icon: icon(List), run: () => onSelect({ kind: "all", filter: EMPTY_FILTER }) },
    { key: "time", group: space, label: "Затраты времени", icon: icon(Clock), run: () => onSelect({ kind: "time" }) },
    ...data.goals.map((g): Item => ({ key: `goal:${g.id}`, group: "Пространства", label: g.title, hint: "цель", icon: icon(Target), run: () => onSelect({ kind: "goal", id: g.id }) })),
    ...data.projects.map((p): Item => ({
      key: `project:${p.id}`,
      group: "Пространства",
      label: spaceOf(data, { kind: "project", id: p.id }).label,
      hint: "проект",
      icon: icon(Folder),
      run: () => onSelect({ kind: "project", id: p.id }),
    })),
    ...[...READY_VIEWS, ...data.views].map((v): Item => ({
      key: `view:${v.id}`,
      group: "Пространства",
      label: v.name,
      hint: "подборка",
      icon: icon(ListFilter),
      run: () => onSelect({ kind: "all", filter: v.filter }),
    })),
  ].filter((i) => match(i.label));

  const name = query.trim();
  const actions: Item[] = [
    { key: "new-task", group: action, label: name ? `Новая задача «${name}»` : "Новая задача", hint: "Shift+N", icon: icon(Plus), run: () => onQuickAdd(name) },
    ...(name
      ? [{
          key: "new-goal",
          group: action,
          label: `Новая цель «${name}»`,
          icon: icon(Target),
          run: () => {
            const id = addGoal(name);
            if (id) onSelect({ kind: "goal", id });
          },
        }]
      : []),
    { key: "theme", group: action, label: "Сменить тему (светлая / тёмная)", icon: icon(Moon), run: toggleTheme },
    { key: "backup", group: action, label: "Скачать копию (JSON)", icon: icon(Download), run: () => exportJson(currentData()) },
    { key: "help", group: action, label: "Горячие клавиши", hint: "?", icon: icon(Keyboard), run: onHelp },
  ].filter((i) => !q || i.key === "new-task" || i.key === "new-goal" || match(i.label));

  const items = [...tasks, ...spaceItems, ...actions];
  const activeIndex = Math.min(active, items.length - 1);
  const run = (item: Item) => {
    onClose();
    // Действие — после закрытия палитры: иначе браузер, закрывая её окно, вернёт фокус туда,
    // где он был до палитры, и уведёт его из следующего окна (например, быстрого ввода)
    setTimeout(item.run, 0);
  };

  // Подсвеченный пункт всегда виден в прокручиваемом списке
  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listId]);

  return (
    <div className="space-y-2">
      <input
        autoFocus
        value={query}
        placeholder="Найти задачу, перейти или выполнить действие"
        aria-label="Палитра команд"
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive(Math.min(activeIndex + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive(Math.max(activeIndex - 1, 0));
          } else if (e.key === "Enter" && activeIndex >= 0) {
            e.preventDefault();
            run(items[activeIndex]);
          }
        }}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <ul id={listId} role="listbox" aria-label="Результаты" className="max-h-[50vh] overflow-auto">
        {items.map((item, i) => (
          <li key={item.key} role="presentation">
            {(i === 0 || items[i - 1].group !== item.group) && (
              <div className="px-2 pt-2 pb-1 text-xs font-medium text-zinc-500" aria-hidden="true">
                {item.group}
              </div>
            )}
            <div
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(item)}
              onMouseMove={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm ${i === activeIndex ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
            >
              {item.icon}
              <span className="min-w-0 truncate">{item.label}</span>
              {item.hint && <span className="ml-auto shrink-0 truncate pl-2 text-xs text-zinc-500">{item.hint}</span>}
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="px-2 py-3 text-sm text-zinc-500">Ничего не найдено.</li>}
      </ul>
      <p className="text-xs text-zinc-500">↑↓ — выбор, Enter — выполнить, Esc — закрыть</p>
    </div>
  );
}
