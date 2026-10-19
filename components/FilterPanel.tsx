"use client";

import { useState } from "react";
import { DEADLINE_FILTERS, PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS, VIEW_NAME_MAX, type AppData, type TaskFilter } from "@/lib/model";
import { allTags, EMPTY_FILTER, isEmptyFilter, READY_VIEWS, sameFilter } from "@/lib/filters";
import { addView } from "@/lib/store";
import { TextInput } from "./ui";

// Панель условий на экране «Все»: статус, приоритет, тег, дедлайн, «без цели», «больше 4 ч».
// Любое сочетание можно сохранить как вид — он появится в разделе «Виды» левого меню.

const DEADLINE_LABELS: Record<(typeof DEADLINE_FILTERS)[number], string> = {
  overdue: "Просрочено",
  today: "Сегодня",
  week: "На этой неделе",
};

const selectClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const buttonClass =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

export function FilterPanel({ data, filter, onFilter }: { data: AppData; filter: TaskFilter; onFilter: (f: TaskFilter) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tags = allTags(data);
  // Тег из сохранённого вида мог пропасть из задач — оставляем его в списке, чтобы выбор было видно
  const filterTag = filter.tag;
  if (filterTag !== null && !tags.some((tg) => tg.toLocaleLowerCase("ru") === filterTag.toLocaleLowerCase("ru"))) tags.push(filterTag);
  const existing = [...READY_VIEWS, ...data.views].find((v) => sameFilter(v.filter, filter));
  const set = (patch: Partial<TaskFilter>) => {
    setError(null);
    onFilter({ ...filter, ...patch });
  };

  return (
    <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Статус
          <select value={filter.status ?? ""} onChange={(e) => set({ status: (e.target.value || null) as TaskFilter["status"] })} className={selectClass}>
            <option value="">Любой</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Приоритет
          <select value={filter.priority ?? ""} onChange={(e) => set({ priority: (e.target.value || null) as TaskFilter["priority"] })} className={selectClass}>
            <option value="">Любой</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
            <option value="none">Без приоритета</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-zinc-500">
          Тег
          <select value={filter.tag ?? ""} onChange={(e) => set({ tag: e.target.value || null })} className={`${selectClass} max-w-48`}>
            <option value="">Любой</option>
            {tags.map((tg) => (
              <option key={tg} value={tg}>
                {tg}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Дедлайн
          <select value={filter.deadline ?? ""} onChange={(e) => set({ deadline: (e.target.value || null) as TaskFilter["deadline"] })} className={selectClass}>
            <option value="">Любой</option>
            {DEADLINE_FILTERS.map((d) => (
              <option key={d} value={d}>
                {DEADLINE_LABELS[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-9 items-center gap-1.5 text-sm">
          <input type="checkbox" checked={filter.noGoal} onChange={(e) => set({ noGoal: e.target.checked })} className="size-4 accent-indigo-600" />
          Без цели
        </label>
        <label className="flex min-h-9 items-center gap-1.5 text-sm">
          <input type="checkbox" checked={filter.over4h} onChange={(e) => set({ over4h: e.target.checked })} className="size-4 accent-indigo-600" />
          Больше 4 ч
        </label>
      </div>

      {!isEmptyFilter(filter) && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => set(EMPTY_FILTER)} className={buttonClass}>
            Сбросить
          </button>
          {existing === undefined &&
            (saving ? (
              <div className="w-64 max-w-full">
                <TextInput
                  autoFocus
                  placeholder="Название вида — Enter"
                  ariaLabel="Название вида"
                  maxLength={VIEW_NAME_MAX}
                  onSubmit={(name) => {
                    const result = addView(name, filter);
                    if ("error" in result) {
                      setError(result.error);
                      return false;
                    }
                    setSaving(false);
                  }}
                  onCancel={() => setSaving(false)}
                />
              </div>
            ) : (
              <button type="button" onClick={() => setSaving(true)} className={buttonClass}>
                Сохранить как вид
              </button>
            ))}
        </div>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
