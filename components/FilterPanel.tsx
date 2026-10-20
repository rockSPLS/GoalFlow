"use client";

import { useState } from "react";
import { DEADLINE_FILTERS, PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS, VIEW_NAME_MAX, type AppData, type TaskFilter } from "@/lib/model";
import { allTags, EMPTY_FILTER, isEmptyFilter, READY_VIEWS, sameFilter } from "@/lib/filters";
import { addView } from "@/lib/store";
import { MultiSelect } from "./MultiSelect";
import { TextInput } from "./ui";

// Панель условий на экране «Все»: статус, приоритет, теги, дедлайн (в каждом — несколько значений,
// «любое из выбранных»), «без цели», «больше 4 ч». Любое сочетание можно сохранить как подборку.

const DEADLINE_LABELS: Record<(typeof DEADLINE_FILTERS)[number], string> = {
  overdue: "Просрочено",
  today: "Сегодня",
  week: "На этой неделе",
};

const buttonClass =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

export function FilterPanel({ data, filter, onFilter }: { data: AppData; filter: TaskFilter; onFilter: (f: TaskFilter) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tags = allTags(data);
  // Тег из сохранённой подборки мог пропасть из справочника или быть записан в другом регистре —
  // в списке показываем его написание из фильтра, чтобы флажок стоял и выбор было видно
  for (const ft of filter.tags) {
    const i = tags.findIndex((tg) => tg.toLocaleLowerCase("ru") === ft.toLocaleLowerCase("ru"));
    if (i === -1) tags.push(ft);
    else tags[i] = ft;
  }
  const existing = [...READY_VIEWS, ...data.views].find((v) => sameFilter(v.filter, filter));
  const set = (patch: Partial<TaskFilter>) => {
    setError(null);
    onFilter({ ...filter, ...patch });
  };

  return (
    <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-end gap-3">
        <MultiSelect
          label="Статус"
          options={STATUSES.map((st) => ({ value: st, label: STATUS_LABELS[st] }))}
          value={filter.status}
          onChange={(v) => set({ status: v as TaskFilter["status"] })}
        />
        <MultiSelect
          label="Приоритет"
          options={[...PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] })), { value: "none", label: "Без приоритета" }]}
          value={filter.priority}
          onChange={(v) => set({ priority: v as TaskFilter["priority"] })}
        />
        <MultiSelect
          label="Тег"
          search
          emptyText="Тегов пока нет"
          options={tags.map((tg) => ({ value: tg, label: tg }))}
          value={filter.tags}
          onChange={(v) => set({ tags: v })}
        />
        <MultiSelect
          label="Дедлайн"
          options={DEADLINE_FILTERS.map((d) => ({ value: d, label: DEADLINE_LABELS[d] }))}
          value={filter.deadline}
          onChange={(v) => set({ deadline: v as TaskFilter["deadline"] })}
        />
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
                  placeholder="Название подборки — Enter"
                  ariaLabel="Название подборки"
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
                Сохранить как подборку
              </button>
            ))}
        </div>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
