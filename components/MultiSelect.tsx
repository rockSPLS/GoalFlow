"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";

// Мультивыбор с чипами: выбранные значения — плашками прямо в поле (с крестиком), список открывается
// по клику, строку выбирают кликом целиком (выбранные отмечены галочкой), список остаётся открытым,
// чтобы отметить несколько. search — поиск печатается прямо в поле (для длинных списков, например тегов).
// Клавиатура: ↑↓ — по списку, Enter — отметить или снять, Backspace в пустом поле — убрать последний чип,
// Esc — закрыть список.

export type MultiOption = { value: string; label: string };

export function MultiSelect({
  label,
  options,
  value,
  onChange,
  search = false,
  emptyText = "Нет вариантов",
}: {
  label: string;
  options: MultiOption[];
  value: string[];
  onChange: (value: string[]) => void;
  search?: boolean;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  // Клик мимо закрывает список
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const lower = (text: string) => text.toLocaleLowerCase("ru");
  const shown = search && query.trim() ? options.filter((o) => lower(o.label).includes(lower(query.trim()))) : options;
  const activeIndex = Math.min(active, shown.length - 1);
  const selected = value.map((v) => options.find((o) => o.value === v) ?? { value: v, label: v });

  // Подсвеченный стрелками пункт всегда виден в прокручиваемом списке
  useEffect(() => {
    if (open && activeIndex >= 0) document.getElementById(`${id}-opt-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, id]);

  // После выбора набранный поиск очищается — список снова показывает всё
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
    if (search && query) {
      setQuery("");
      setActive(-1);
    }
  };
  const summary = selected.length ? selected.map((o) => o.label).join(", ") : "Любой";
  const focusControl = () => (search ? inputRef.current : controlRef.current)?.focus();

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive(Math.min(activeIndex + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter" || (e.key === " " && !search)) {
      // В поле поиска пробел печатается как обычно; без поиска пробел, как и Enter, отмечает пункт
      e.preventDefault();
      if (!open) setOpen(true);
      else if (activeIndex >= 0) toggle(shown[activeIndex].value);
      else setActive(0);
    } else if (e.key === "Backspace" && query === "" && value.length > 0) {
      e.preventDefault();
      onChange(value.slice(0, -1));
    } else if (e.key === "Escape" && open) {
      // Esc закрывает только список (и не уходит дальше — например, к сообщению внизу экрана)
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  // Общие свойства поля-комбобокса: им становится поле поиска или, без поиска, сам контейнер с чипами
  const comboProps = {
    role: "combobox",
    "aria-expanded": open,
    "aria-controls": `${id}-list`,
    // Подпись поля и выбранные значения — чтобы экранный диктор слышал, что уже выбрано
    "aria-labelledby": `${id}-label ${id}-value`,
    "aria-activedescendant": open && activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined,
    onKeyDown,
  } as const;

  return (
    <div
      ref={rootRef}
      className="relative flex flex-col gap-1 text-xs text-zinc-500"
      // Фокус ушёл за пределы поля (например, клавишей Tab) — закрываем список
      onBlur={(e) => {
        if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <span id={`${id}-label`}>{label}</span>
      <span id={`${id}-value`} className="sr-only">
        {summary}
      </span>
      <div
        ref={controlRef}
        {...(search ? {} : { ...comboProps, tabIndex: 0 })}
        onMouseDown={(e) => {
          // Клик по полю (не по крестику чипа) открывает или закрывает список и ставит фокус в поле.
          // Клик в само поле поиска только открывает список — курсор встаёт туда, куда кликнули
          if ((e.target as HTMLElement).closest("button")) return;
          if (e.target === inputRef.current) {
            setOpen(true);
            return;
          }
          e.preventDefault();
          setOpen(!open);
          focusControl();
        }}
        className="flex min-h-9 w-56 max-w-full cursor-pointer flex-wrap items-center gap-1 rounded-md border border-zinc-300 bg-white py-1 pr-7 pl-1.5 text-sm text-zinc-900 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {selected.map((o) => (
          <span key={o.value} className="flex max-w-full items-center gap-0.5 rounded bg-zinc-100 py-0.5 pr-0.5 pl-1.5 text-xs dark:bg-zinc-800">
            <span className="truncate">{o.label}</span>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                toggle(o.value);
                focusControl();
              }}
              aria-label={`Убрать «${o.label}»`}
              className="rounded p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        {search ? (
          <input
            ref={inputRef}
            {...comboProps}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            placeholder={value.length ? "" : "Любой"}
            aria-autocomplete="list"
            className="min-w-12 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-zinc-900 dark:placeholder:text-zinc-100"
          />
        ) : (
          value.length === 0 && <span className="px-1">Любой</span>
        )}
        <ChevronDown size={14} className="pointer-events-none absolute right-2 bottom-2.5 text-zinc-500" aria-hidden="true" />
      </div>
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-multiselectable="true"
          aria-labelledby={`${id}-label`}
          // Нажатие внутри списка не уводит фокус из поля
          onMouseDown={(e) => e.preventDefault()}
          className="absolute top-full left-0 z-20 mt-1 max-h-64 w-56 max-w-[80vw] overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm text-zinc-900 shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {shown.map((o, i) => {
            const isOn = value.includes(o.value);
            return (
              <li
                key={o.value}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={isOn}
                onClick={() => toggle(o.value)}
                onMouseMove={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 ${i === activeIndex ? "bg-zinc-100 dark:bg-zinc-800" : ""} ${isOn ? "font-medium" : ""}`}
              >
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {isOn && <Check size={14} className="shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />}
              </li>
            );
          })}
          {shown.length === 0 && <li role="presentation" className="px-3 py-1.5 text-xs text-zinc-500">{options.length === 0 ? emptyText : "Ничего не найдено"}</li>}
        </ul>
      )}
    </div>
  );
}
