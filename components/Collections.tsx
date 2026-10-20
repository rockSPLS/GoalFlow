"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { AppData, TaskFilter } from "@/lib/model";
import { EMPTY_FILTER, filterTasks, READY_VIEWS, sameFilter, todayKey } from "@/lib/filters";
import { deleteView } from "@/lib/store";

// Подборки над фильтрами на экране «Все»: «Все», готовые и свои сохранённые наборы условий, у каждой —
// число невыполненных задач. Клик применяет условия, у своих подборок есть крестик удаления.
// Ряд не выше двух строк, чтобы не сдвигать список задач; если не помещается — «Показать все».

export function Collections({ data, filter, onFilter }: { data: AppData; filter: TaskFilter; onFilter: (f: TaskFilter) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const rowRef = useRef<HTMLUListElement>(null);
  const today = todayKey();
  const items = [
    { id: "all", name: "Все", filter: EMPTY_FILTER, own: false },
    ...READY_VIEWS.map((v) => ({ ...v, own: false })),
    ...data.views.map((v) => ({ ...v, own: true })),
  ];
  const count = (f: TaskFilter) => filterTasks(data, data.tasks, f, today).filter((t) => t.status !== "done").length;

  // Помещаются ли подборки в две строки — проверяем при изменении размера ряда и каждой ячейки
  // (ширина ячейки меняется вместе с числом задач в ней)
  const signature = items.map((i) => i.id).join("|");
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const observer = new ResizeObserver(() => setOverflow(row.scrollHeight > row.clientHeight + 1));
    observer.observe(row);
    for (const cell of row.children) observer.observe(cell);
    return () => observer.disconnect();
  }, [signature, expanded]);

  const chip = (active: boolean) =>
    `flex h-7 items-center gap-1.5 rounded-full border text-sm ${
      active
        ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"
        : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
    }`;

  return (
    <section aria-label="Подборки" className="space-y-1">
      {/* Две строки: высота двух кнопок (h-7) и промежутка между ними (gap-1.5) */}
      <ul
        ref={rowRef}
        // Фокус клавиатуры попал на подборку, скрытую за второй строкой, — раскрываем ряд, чтобы её было видно.
        // Положение ячейки берём внутри ряда (offsetTop): браузер при фокусе сам прокручивает обрезанный ряд,
        // и по экранным координатам ячейка уже выглядела бы видимой
        onFocus={(e) => {
          const row = rowRef.current;
          const cell = e.target.closest("li");
          if (!expanded && row && cell && cell.offsetTop + cell.offsetHeight > row.clientHeight) {
            row.scrollTop = 0;
            setExpanded(true);
          }
        }}
        className={`relative flex flex-wrap gap-1.5 ${expanded ? "" : "max-h-[3.875rem] overflow-hidden"}`}
      >
        {items.map((item) => {
          const active = sameFilter(item.filter, filter);
          const n = count(item.filter);
          return (
            <li key={item.id} className={chip(active)}>
              <button
                type="button"
                onClick={() => onFilter(item.filter)}
                aria-pressed={active}
                className={`flex h-full items-center gap-1.5 rounded-full ${item.own ? "pl-3" : "px-3"}`}
              >
                {item.name}
                {n > 0 && <span className="text-xs text-zinc-500">{n}</span>}
              </button>
              {item.own && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Удалить подборку «${item.name}»? Задачи останутся.`)) deleteView(item.id);
                  }}
                  aria-label={`Удалить подборку «${item.name}»`}
                  title="Удалить подборку"
                  className="mr-1 rounded-full p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {(overflow || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="rounded px-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {expanded ? "Свернуть подборки" : `Показать все подборки (${items.length})`}
        </button>
      )}
    </section>
  );
}
