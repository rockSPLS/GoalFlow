"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Calendar, Flag, Gauge, X } from "lucide-react";
import { PRIORITY_LABELS, TAG_MAX, TAGS_PER_TASK, type AppData, type Parent } from "@/lib/model";
import { allTags, tagColor } from "@/lib/filters";
import { parseDeadline, parseQuickAdd } from "@/lib/quick-add";
import { addTask } from "@/lib/store";
import { formatDay, formatWeekday } from "@/lib/time";
import { sameParent, spaceOf, useAppUi } from "./app-ui";
import { PRIORITY_COLORS } from "./task-ui";

// Поле быстрого ввода: название и метки со значками (# тег, !1–3 приоритет, @ цель или проект,
// ^ дедлайн, 3sp оценка). После @, # и ^ выпадает список подсказок; выбранная цель или проект
// и выбранные теги становятся плашками. Под полем — что будет создано и что не распознано.
// Подсказку берут только явно (стрелками или мышью), Enter без выбора — создать задачу.

const SUGGESTIONS = 8;
const lower = (text: string) => text.toLocaleLowerCase("ru");
// Сравнение названий: без учёта регистра и лишних пробелов
const norm = (text: string) => lower(text.replace(/\s+/g, " ").trim());

// Подсказка и что она делает при выборе: пространство, тег или слово даты
type Option = {
  key: string;
  label: string;
  hint?: string;
  action: { type: "space"; parent: Parent } | { type: "tag"; tag: string } | { type: "date"; word: string };
};
// Метка, на которой сейчас стоит курсор: значок, набранное после него и начало метки в тексте
type Token = { marker: "@" | "#" | "^"; query: string; start: number; end: number };

const DATE_WORDS = ["сегодня", "завтра", "послезавтра", "пн", "вт", "ср", "чт", "пт", "сб", "вс"];

function tokenAt(text: string, caret: number): Token | null {
  const before = text.slice(0, caret);
  const m = /(^|\s)([@#^])(\S*)$/.exec(before);
  if (!m) return null;
  return { marker: m[2] as Token["marker"], query: m[3], start: caret - m[3].length - 1, end: caret };
}

// Все пространства для подсказок после @. names — как пространство можно набрать вручную:
// проект в цели — и «Цель: Проект», и просто «Проект»
function spaces(data: AppData): { parent: Parent; label: string; kind: string; names: string[] }[] {
  return [
    { parent: { kind: "inbox" }, label: "Неразобранные", kind: "", names: ["Неразобранные"] },
    ...data.goals.map((g) => ({ parent: { kind: "goal", id: g.id } as Parent, label: g.title, kind: "цель", names: [g.title] })),
    ...data.projects.map((p) => {
      const label = spaceOf(data, { kind: "project", id: p.id }).label;
      return { parent: { kind: "project", id: p.id } as Parent, label, kind: "проект", names: label === p.title ? [label] : [label, p.title] };
    }),
  ];
}

export function QuickAdd({
  data,
  defaultParent,
  placeholder,
  autoFocus,
  initialText = "",
  onAdded,
}: {
  data: AppData;
  // Куда попадает задача без @ — открытая цель или проект, иначе «Неразобранные»
  defaultParent: Parent;
  placeholder: string;
  autoFocus?: boolean;
  initialText?: string;
  onAdded?: () => void;
}) {
  const { notify } = useAppUi();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initialText);
  const [caret, setCaret] = useState(initialText.length);
  const [space, setSpace] = useState<Parent | null>(null);
  const [chipTags, setChipTags] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Ошибки показываются после первой попытки создать задачу — чтобы не ругаться на недописанное
  const [tried, setTried] = useState(false);
  const [focused, setFocused] = useState(false);

  const allSpaces = spaces(data);
  const now = new Date();
  const draft = parseQuickAdd(text, now, allSpaces.flatMap((s) => s.names));
  // Набранные вручную @… сопоставляются с названиями пространств (без учёта регистра)
  const typedSpaces = draft.spaceTokens.map((t) => ({ token: t, found: allSpaces.filter((s) => s.names.some((n) => norm(n) === norm(t))) }));
  const errors = [...draft.errors];
  for (const t of typedSpaces) {
    if (t.found.length === 0) errors.push(`Нет цели или проекта «${t.token}» — выберите из списка после @.`);
    else if (t.found.length > 1) errors.push(`«${t.token}» — так называются несколько пространств, выберите из списка после @.`);
  }
  const resolved = typedSpaces.filter((t) => t.found.length === 1).map((t) => t.found[0].parent);
  if (resolved.length + (space ? 1 : 0) > 1) errors.push("Цель или проект указаны дважды — оставьте одно.");
  const tags = [...chipTags];
  for (const tg of draft.tags) if (!tags.some((t) => lower(t) === lower(tg))) tags.push(tg);
  if (tags.length > TAGS_PER_TASK) errors.push(`У задачи может быть не больше ${TAGS_PER_TASK} тегов.`);
  if (!draft.title) errors.push("Введите название задачи.");
  const target = space ?? resolved[0] ?? defaultParent;

  // Подсказки для метки под курсором
  const token = focused ? tokenAt(text, caret) : null;
  let options: Option[] = [];
  if (token?.marker === "@") {
    options = allSpaces
      .filter((s) => lower(s.label).includes(lower(token.query)))
      .slice(0, SUGGESTIONS)
      .map((s) => ({
        key: `space:${s.label}:${"id" in s.parent ? s.parent.id : "inbox"}`,
        label: s.label,
        hint: s.kind,
        action: { type: "space", parent: s.parent },
      }));
  } else if (token?.marker === "#") {
    const q = lower(token.query);
    const taken = new Set(tags.map(lower));
    const found = allTags(data).filter((tg) => !taken.has(lower(tg)) && lower(tg).includes(q));
    found.sort((a, b) => Number(!lower(a).startsWith(q)) - Number(!lower(b).startsWith(q)));
    options = found.slice(0, SUGGESTIONS).map((tg) => ({ key: `tag:${tg}`, label: tg, action: { type: "tag", tag: tg } }));
    // Новый тег — только допустимой длины (слишком длинный останется в тексте и даст ошибку при создании)
    if (token.query && token.query.length <= TAG_MAX && !allTags(data).some((tg) => lower(tg) === q) && !taken.has(q)) {
      options.push({ key: "tag:new", label: `Создать тег «${token.query}»`, action: { type: "tag", tag: token.query } });
    }
  } else if (token?.marker === "^") {
    const q = lower(token.query);
    const words = DATE_WORDS.filter((w) => w.startsWith(q));
    // Набранная дата вида 25.10 — тоже вариант, если распознаётся
    if (q && !words.includes(q) && parseDeadline(q, now)) words.push(q);
    options = words.map((w) => {
      const date = parseDeadline(w, now) ?? "";
      return {
        key: `date:${w}`,
        label: w,
        // У дня недели подсказка — только дата («26 окт.»), у остальных — с днём недели («чт, 22 окт.»)
        hint: date ? (w.length === 2 ? formatDay : formatWeekday)(new Date(`${date}T12:00:00`)) : "",
        action: { type: "date", word: w },
      };
    });
  }
  const shown = open && options.length > 0;
  const activeIndex = Math.min(active, options.length - 1);

  // Подсвеченная стрелками подсказка всегда видна в прокручиваемом списке
  useEffect(() => {
    if (shown && activeIndex >= 0) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [shown, activeIndex, listId]);

  // Выбор подсказки (только из обработчиков событий): метка под курсором заменяется — дата остаётся
  // в тексте словом «^завтра», а пространство и тег становятся плашками
  const pick = (option: Option) => {
    if (!token) return;
    const a = option.action;
    const replacement = a.type === "date" ? `^${a.word} ` : "";
    if (a.type === "space") setSpace(a.parent);
    if (a.type === "tag") setChipTags([...chipTags, a.tag]);
    const next = text.slice(0, token.start) + replacement + text.slice(token.end).replace(/^\s+/, "");
    const pos = token.start + replacement.length;
    setText(next);
    setCaret(pos);
    setActive(-1);
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(pos, pos));
  };

  const submit = () => {
    setTried(true);
    if (errors.length > 0) return;
    const id = addTask(draft.title, target, { tags, priority: draft.priority, deadline: draft.deadline, weight: draft.weight });
    if (!id) return;
    // Задача ушла не туда, где пользователь сейчас, — сообщаем и даём перейти к ней или в пространство
    if (!sameParent(target, defaultParent)) {
      const s = spaceOf(data, target);
      notify({ kind: "added", taskId: id, title: draft.title, space: s.selection, spaceLabel: s.label });
    }
    setText("");
    setCaret(0);
    setSpace(null);
    setChipTags([]);
    setTried(false);
    setActive(-1);
    onAdded?.();
  };

  const syncCaret = () => setCaret(inputRef.current?.selectionStart ?? text.length);
  const plate = "flex items-center gap-1 rounded px-2 py-0.5 text-xs";
  const hasFields = space || resolved.length || tags.length || draft.priority || draft.deadline || draft.weight;

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          ref={inputRef}
          value={text}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={shown}
          aria-controls={listId}
          aria-activedescendant={shown && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          aria-describedby={`${listId}-hint`}
          maxLength={400}
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
            setOpen(true);
            setActive(-1);
          }}
          onSelect={syncCaret}
          onFocus={() => {
            setFocused(true);
            setOpen(true);
          }}
          onBlur={() => {
            setFocused(false);
            setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "ArrowDown" && shown) {
              e.preventDefault();
              setActive(Math.min(activeIndex + 1, options.length - 1));
            } else if (e.key === "ArrowUp" && shown) {
              e.preventDefault();
              setActive(Math.max(activeIndex - 1, -1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (shown && activeIndex >= 0) pick(options[activeIndex]);
              else submit();
            } else if (e.key === "Escape" && shown) {
              // Первый Esc закрывает подсказки, а не окно быстрого ввода
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              setActive(-1);
            }
          }}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {shown && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Подсказки"
            onMouseDown={(e) => e.preventDefault()}
            className="absolute top-full left-0 z-20 mt-1 max-h-64 w-full max-w-sm overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-md dark:border-zinc-700 dark:bg-zinc-900"
          >
            {options.map((option, i) => (
              <li
                key={option.key}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(option);
                }}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${
                  i === activeIndex ? "bg-zinc-200 dark:bg-zinc-700" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {token?.marker === "#" && option.key !== "tag:new" ? (
                  <span className={`truncate rounded px-1.5 py-0.5 text-xs ${tagColor(option.label)}`}>{option.label}</span>
                ) : (
                  <span className="truncate">{option.label}</span>
                )}
                {option.hint && <span className="ml-auto shrink-0 text-xs text-zinc-500">{option.hint}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {(focused || text) && (
        <p id={`${listId}-hint`} className="text-xs text-zinc-500">
          # тег · !1 !2 !3 приоритет · @ цель или проект · ^ дедлайн (завтра, пт, 25.10) · 3sp оценка · Enter — создать
        </p>
      )}
      {!(focused || text) && <span id={`${listId}-hint`} className="sr-only">Метки: # тег, !1–3 приоритет, @ цель или проект, ^ дедлайн, 3sp оценка.</span>}

      {(text.trim() || hasFields) && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs" aria-live="polite">
          <span className="text-zinc-500">Будет создано в:</span>
          <span className={`${plate} bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300`}>
            {spaceOf(data, target).label}
            {space && (
              <button type="button" onClick={() => setSpace(null)} aria-label="Убрать выбранное пространство" className="rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10">
                <X size={12} aria-hidden="true" />
              </button>
            )}
          </span>
          {draft.priority && (
            <span className={`${plate} bg-zinc-100 dark:bg-zinc-800`}>
              <Flag size={12} className={PRIORITY_COLORS[draft.priority]} aria-hidden="true" />
              {PRIORITY_LABELS[draft.priority]}
            </span>
          )}
          {draft.deadline && (
            <span className={`${plate} bg-zinc-100 dark:bg-zinc-800`}>
              <Calendar size={12} aria-hidden="true" />
              до {formatDay(new Date(`${draft.deadline}T12:00:00`))}
            </span>
          )}
          {draft.weight && (
            <span className={`${plate} bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300`}>
              <Gauge size={12} aria-hidden="true" />
              {draft.weight} SP
            </span>
          )}
          {tags.map((tg) => (
            <span key={tg} className={`${plate} ${tagColor(tg)}`}>
              {tg}
              {chipTags.includes(tg) && (
                <button type="button" onClick={() => setChipTags(chipTags.filter((t) => t !== tg))} aria-label={`Убрать тег «${tg}»`} className="rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10">
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {tried && errors.length > 0 && (
        <ul className="space-y-0.5 text-xs text-red-600 dark:text-red-400">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
