"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Calendar, Clock, Flag, Gauge, Link, Tag, Trash, X } from "lucide-react";
import {
  DEFAULT_WEIGHT,
  DESCRIPTION_MAX,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  TAG_MAX,
  TAGS_PER_TASK,
  TITLE_MAX,
  WEIGHTS,
  WEIGHT_HINTS,
  type AppData,
  type Parent,
  type Status,
  type Task,
} from "@/lib/model";
import { allTags, deadlineState, tagColor, todayKey } from "@/lib/filters";
import {
  addTaskTag,
  deleteTag,
  deleteTask,
  linkTasks,
  moveTask,
  removeTaskTag,
  renameTask,
  setTaskDeadline,
  setTaskDescription,
  setTaskPriority,
  setTaskWeight,
  tagUsage,
  unlinkTasks,
} from "@/lib/store";
import { formatDay, formatMinutes, sumMinutes } from "@/lib/time";
import { changeStatus, TaskTimeSection } from "./TimeParts";
import { pathOf, PRIORITY_COLORS, useTaskUi } from "./task-ui";

// Карточка задачи: название, описание, статус и место, панель иконок для остальных полей.
// Заполненные поля видны плашками; по клику на иконку или плашку раскрывается одно поле.

type Field = "weight" | "deadline" | "priority" | "tags" | "related" | "time";

const FIELDS: { field: Field; label: string; Icon: typeof Gauge }[] = [
  { field: "weight", label: "Оценка SP", Icon: Gauge },
  { field: "deadline", label: "Дедлайн", Icon: Calendar },
  { field: "priority", label: "Приоритет", Icon: Flag },
  { field: "tags", label: "Теги", Icon: Tag },
  { field: "related", label: "Связанные задачи", Icon: Link },
  { field: "time", label: "Затраты времени", Icon: Clock },
];

const fieldClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

function parentValue(task: Task): string {
  if (task.projectId) return `project:${task.projectId}`;
  if (task.goalId) return `goal:${task.goalId}`;
  return "inbox";
}

function parseParent(value: string): Parent {
  const sep = value.indexOf(":");
  const kind = sep === -1 ? value : value.slice(0, sep);
  const id = sep === -1 ? "" : value.slice(sep + 1);
  if (kind === "project" && id) return { kind: "project", id };
  if (kind === "goal" && id) return { kind: "goal", id };
  return { kind: "inbox" };
}

export function TaskEditor({ task, data, onClose }: { task: Task; data: AppData; onClose: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [openField, setOpenField] = useState<Field | null>(null);
  const orphanProjects = data.projects.filter((p) => p.goalId === null);
  const spent = sumMinutes(data.timeEntries.filter((e) => e.taskId === task.id));
  const running = data.timer?.taskId === task.id;

  const saveTitle = () => {
    if (title.trim() && title.trim() !== task.title) renameTask(task.id, title);
    else setTitle(task.title);
  };
  const toggleField = (field: Field) => setOpenField(openField === field ? null : field);

  // Заполнено ли поле — такие иконки подсвечены
  const filled: Record<Field, boolean> = {
    weight: task.weight !== null,
    deadline: task.deadline !== null,
    priority: task.priority !== null,
    tags: task.tags.length > 0,
    related: task.relatedTaskIds.length > 0,
    time: spent > 0 || running,
  };

  const plate = (field: Field, content: ReactNode, color: string, key: string = field) => (
    <button
      key={key}
      type="button"
      onClick={() => toggleField(field)}
      aria-expanded={openField === field}
      className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs hover:ring-1 hover:ring-zinc-400 ${color}`}
    >
      {content}
    </button>
  );
  const deadline = deadlineState(task, todayKey());

  return (
    <div className="mx-2 mb-2 space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <input
            value={title}
            maxLength={TITLE_MAX}
            aria-label="Название задачи"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setTitle(task.title);
            }}
            className={`${fieldClass} flex-1`}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть карточку задачи"
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <textarea
          value={description}
          maxLength={DESCRIPTION_MAX}
          rows={2}
          placeholder="Описание"
          aria-label="Описание задачи"
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => setTaskDescription(task.id, description)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setDescription(task.description);
          }}
          className={`${fieldClass} block min-h-16 w-full resize-y [field-sizing:content]`}
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Статус
          <select
            value={task.status}
            onChange={(e) => changeStatus(task.id, e.target.value as Status)}
            className={`${fieldClass} text-zinc-900 dark:text-zinc-100`}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-zinc-500">
          Цель / проект
          <select
            value={parentValue(task)}
            onChange={(e) => moveTask(task.id, parseParent(e.target.value))}
            className={`${fieldClass} max-w-full text-zinc-900 dark:text-zinc-100`}
          >
            <option value="inbox">Неразобранные</option>
            {data.goals.map((g) => [
              <option key={g.id} value={`goal:${g.id}`}>
                {g.title} (без проекта)
              </option>,
              ...data.projects
                .filter((p) => p.goalId === g.id)
                .map((p) => (
                  <option key={p.id} value={`project:${p.id}`}>
                    {g.title}: {p.title}
                  </option>
                )),
            ])}
            {orphanProjects.length > 0 && (
              <optgroup label="Проекты без цели">
                {orphanProjects.map((p) => (
                  <option key={p.id} value={`project:${p.id}`}>
                    {p.title}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
      </div>

      <div className="space-y-2">
        {/* Заполненные поля — плашками над иконками */}
        {Object.values(filled).some(Boolean) && (
          <div className="flex flex-wrap gap-1.5">
            {task.weight !== null &&
              plate(
                "weight",
                <>
                  <Gauge size={12} aria-hidden="true" />
                  {task.weight} SP
                </>,
                "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
              )}
            {task.deadline !== null &&
              plate(
                "deadline",
                <>
                  <Calendar size={12} aria-hidden="true" />
                  до {formatDay(new Date(`${task.deadline}T12:00:00`))}
                  {deadline === "overdue" ? " — просрочено" : deadline === "today" ? " — сегодня" : ""}
                </>,
                deadline === "overdue"
                  ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                  : deadline === "today"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                    : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
              )}
            {task.priority !== null &&
              plate(
                "priority",
                <>
                  <Flag size={12} className={PRIORITY_COLORS[task.priority]} aria-hidden="true" />
                  {PRIORITY_LABELS[task.priority]}
                </>,
                "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
              )}
            {task.tags.map((tg) => plate("tags", tg, tagColor(tg), `tag:${tg}`))}
            {task.relatedTaskIds.length > 0 &&
              plate(
                "related",
                <>
                  <Link size={12} aria-hidden="true" />
                  Связанных: {task.relatedTaskIds.length}
                </>,
                "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
              )}
            {(spent > 0 || running) &&
              plate(
                "time",
                <>
                  <Clock size={12} aria-hidden="true" />
                  {running ? "таймер идёт" : formatMinutes(spent)}
                </>,
                "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
              )}
          </div>
        )}

        <div className="flex flex-wrap gap-1" role="group" aria-label="Поля задачи">
          {FIELDS.map(({ field, label, Icon }) => (
            <button
              key={field}
              type="button"
              onClick={() => toggleField(field)}
              aria-expanded={openField === field}
              aria-label={filled[field] ? `${label} (заполнено)` : label}
              title={label}
              className={`flex size-9 items-center justify-center rounded-md ${
                openField === field
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200"
                  : filled[field]
                    ? "text-indigo-600 hover:bg-zinc-200 dark:text-indigo-400 dark:hover:bg-zinc-800"
                    : "text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              <Icon size={18} aria-hidden="true" />
            </button>
          ))}
        </div>

        {/* Раскрытое поле — в отдельной рамке, чтобы не сливалось с иконками и плашками */}
        {openField !== null && (
          <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            {openField === "weight" && <WeightField task={task} />}
            {openField === "deadline" && <DeadlineField task={task} />}
            {openField === "priority" && <PriorityField task={task} />}
            {openField === "tags" && <TagsField task={task} data={data} />}
            {openField === "related" && <RelatedField task={task} data={data} />}
            {openField === "time" && <TaskTimeSection task={task} data={data} />}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          if (window.confirm(`Удалить задачу «${task.title}»?`)) deleteTask(task.id);
        }}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
      >
        <Trash size={16} aria-hidden="true" />
        Удалить задачу
      </button>
    </div>
  );
}

// Кнопки-переключатели в одну строку
function segmentClass(active: boolean) {
  return `min-w-9 rounded-md border px-2.5 py-1 text-sm ${
    active
      ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"
      : "border-zinc-300 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
  }`;
}

// Оценка SP одной строкой «— 1 2 3 5 8» с расшифровкой выбранного значения
function WeightField({ task }: { task: Task }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1 text-xs text-zinc-500">Оценка SP (story points) — влияет на прогресс цели</legend>
      <div className="flex flex-wrap gap-1">
        <button type="button" aria-pressed={task.weight === null} aria-label="Без оценки" title="Без оценки" onClick={() => setTaskWeight(task.id, null)} className={segmentClass(task.weight === null)}>
          —
        </button>
        {WEIGHTS.map((w) => (
          <button
            key={w}
            type="button"
            aria-pressed={task.weight === w}
            aria-label={`${w} SP — ${WEIGHT_HINTS[w]}`}
            title={`${w} SP — ${WEIGHT_HINTS[w]}`}
            onClick={() => setTaskWeight(task.id, w)}
            className={segmentClass(task.weight === w)}
          >
            {w}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        {task.weight === null
          ? `Без оценки — считается как ${DEFAULT_WEIGHT} SP`
          : `${task.weight} SP — ${WEIGHT_HINTS[task.weight]}`}
      </p>
    </fieldset>
  );
}

function DeadlineField({ task }: { task: Task }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Дедлайн
        <input
          type="date"
          value={task.deadline ?? ""}
          onChange={(e) => setTaskDeadline(task.id, e.target.value || null)}
          className={`${fieldClass} text-zinc-900 dark:text-zinc-100`}
        />
      </label>
      {task.deadline !== null && (
        <button type="button" onClick={() => setTaskDeadline(task.id, null)} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
          Убрать дедлайн
        </button>
      )}
    </div>
  );
}

function PriorityField({ task }: { task: Task }) {
  return (
    <fieldset>
      <legend className="mb-1 text-xs text-zinc-500">Приоритет</legend>
      <div className="flex flex-wrap gap-1">
        <button type="button" aria-pressed={task.priority === null} onClick={() => setTaskPriority(task.id, null)} className={segmentClass(task.priority === null)}>
          Без приоритета
        </button>
        {PRIORITIES.map((p) => (
          <button key={p} type="button" aria-pressed={task.priority === p} onClick={() => setTaskPriority(task.id, p)} className={`${segmentClass(task.priority === p)} flex items-center gap-1`}>
            <Flag size={14} className={PRIORITY_COLORS[p]} aria-hidden="true" />
            {PRIORITY_LABELS[p]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// Сколько подсказок тегов показывать
const TAG_SUGGESTIONS = 12;

type TagOption = { kind: "tag" | "new"; tag: string };

const lower = (text: string) => text.toLocaleLowerCase("ru");

// Варианты для введённого текста: существующие теги, которых у задачи ещё нет и которые содержат введённое.
// Порядок: точное совпадение, затем начинающиеся с введённого, затем остальные. В конце — «Создать тег …»,
// если такого тега нет нигде.
function tagOptions(existing: string[], own: Set<string>, text: string): TagOption[] {
  const clean = text.trim().replace(/\s+/g, " ");
  const needle = lower(clean);
  const rank = (tg: string) => (lower(tg) === needle ? 0 : lower(tg).startsWith(needle) ? 1 : 2);
  const options: TagOption[] = existing
    .filter((tg) => !own.has(lower(tg)) && lower(tg).includes(needle))
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, TAG_SUGGESTIONS)
    .map((tag) => ({ kind: "tag", tag }));
  if (clean && !existing.some((tg) => lower(tg) === needle) && !own.has(needle)) options.push({ kind: "new", tag: clean });
  return options;
}

// Теги: свободный ввод с автокомплитом из уже существующих тегов (совпадение по любой части слова).
// Список под полем: стрелки ↑↓ — выбор, Enter — добавить выбранное, Esc — закрыть список.
// По умолчанию ничего не выбрано: Enter добавляет набранный текст; подсказка добавляется только
// после явного выбора стрелками или кликом. Крестик у подсказки (или Delete на выбранной) удаляет тег
// из справочника — и со всех задач, после подтверждения.
// Свой список, а не <datalist>: браузеры показывают datalist по-разному и не дают управлять им с клавиатуры одинаково.
function TagsField({ task, data }: { task: Task; data: AppData }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const own = new Set(task.tags.map(lower));
  const existing = allTags(data);
  const options = tagOptions(existing, own, value);
  const activeIndex = Math.min(active, options.length - 1);
  const shown = open && options.length > 0;

  // Подсвеченный стрелками вариант всегда виден в прокручиваемом списке
  useEffect(() => {
    if (shown && activeIndex >= 0) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [shown, activeIndex, listId]);

  const add = (tag: string) => {
    const result = addTaskTag(task.id, tag);
    setError(result);
    if (result === null) {
      setValue("");
      setActive(-1);
    }
  };

  const removeFromLibrary = (tag: string) => {
    const used = tagUsage(tag);
    const question =
      used > 0
        ? `Удалить тег «${tag}» из справочника? Он стоит у задач: ${used} — с них он тоже будет снят.`
        : `Удалить тег «${tag}» из справочника?`;
    if (window.confirm(question)) {
      deleteTag(tag);
      setActive(-1);
    }
  };

  return (
    <div className="space-y-2">
      {task.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Теги задачи">
          {task.tags.map((tg) => (
            <li key={tg} className={`flex items-center gap-1 rounded py-0.5 pr-1 pl-2 text-xs ${tagColor(tg)}`}>
              {tg}
              <button type="button" onClick={() => removeTaskTag(task.id, tg)} aria-label={`Убрать тег «${tg}»`} className="rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10">
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* Не больше TAGS_PER_TASK тегов: при полном наборе вместо поля — подсказка */}
      {task.tags.length < TAGS_PER_TASK ? (
        <div className="flex flex-wrap items-start gap-2">
          <div className="relative w-56 max-w-full">
            <input
              value={value}
              maxLength={TAG_MAX}
              placeholder="Новый тег"
              aria-label="Новый тег"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={shown}
              aria-controls={listId}
              aria-activedescendant={shown && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
              aria-describedby={`${listId}-hint`}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
                setOpen(true);
                setActive(-1);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setOpen(true);
                  setActive(Math.min(activeIndex + 1, options.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive(Math.max(activeIndex - 1, -1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  add(shown && activeIndex >= 0 ? options[activeIndex].tag : value);
                } else if (e.key === "Delete" && shown && activeIndex >= 0 && options[activeIndex].kind === "tag") {
                  // Delete удаляет из справочника только явно выбранную подсказку; иначе — обычное удаление символа
                  e.preventDefault();
                  removeFromLibrary(options[activeIndex].tag);
                } else if (e.key === "Escape" && shown) {
                  setOpen(false);
                  setActive(-1);
                }
              }}
              className={`${fieldClass} w-full`}
            />
            <p id={`${listId}-hint`} className="sr-only">
              Стрелки вверх и вниз — выбрать подсказку, Enter — добавить, Delete — удалить выбранный тег из справочника.
            </p>
            {shown && (
              <ul
                id={listId}
                role="listbox"
                aria-label="Подходящие теги"
                // Нажатие на полосу прокрутки не должно уводить фокус из поля (иначе список закроется)
                onMouseDown={(e) => e.preventDefault()}
                className="absolute top-full left-0 z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-md dark:border-zinc-700 dark:bg-zinc-900"
              >
                {options.map((option, i) => (
                  <li
                    key={`${option.kind}:${option.tag}`}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    // mousedown, а не click: иначе поле потеряет фокус и список закроется раньше выбора
                    onMouseDown={(e) => {
                      e.preventDefault();
                      add(option.tag);
                    }}
                    className={`flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm ${
                      i === activeIndex ? "bg-zinc-200 dark:bg-zinc-700" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {option.kind === "tag" ? (
                      <>
                        <span className={`truncate rounded px-1.5 py-0.5 text-xs ${tagColor(option.tag)}`}>{option.tag}</span>
                        {/* Крестик — для мыши; с клавиатуры то же делает Delete (подсказка — в описании поля) */}
                        <button
                          type="button"
                          tabIndex={-1}
                          aria-hidden="true"
                          title="Удалить из справочника"
                          onMouseDown={(e) => {
                            // Не выбирать тег и не уводить фокус из поля
                            e.preventDefault();
                            e.stopPropagation();
                            removeFromLibrary(option.tag);
                          }}
                          className="ml-auto rounded p-0.5 text-zinc-400 hover:bg-zinc-300 hover:text-zinc-700 dark:hover:bg-zinc-600 dark:hover:text-zinc-100"
                        >
                          <X size={12} aria-hidden="true" />
                        </button>
                      </>
                    ) : (
                      <span className="truncate text-zinc-600 dark:text-zinc-300">
                        Создать тег «{option.tag}»
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" onClick={() => add(value)} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            Добавить
          </button>
        </div>
      ) : (
        <p role="status" className="text-xs text-zinc-500">
          {task.tags.length > TAGS_PER_TASK
            ? `Тегов ${task.tags.length} — больше, чем можно (${TAGS_PER_TASK}). Чтобы добавить другой, снимите лишние.`
            : `Тегов ${task.tags.length} из ${TAGS_PER_TASK}. Чтобы добавить другой, снимите один из них.`}
        </p>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

// Связанные задачи: переход к связанной, отвязка, поиск задачи для новой связи
function RelatedField({ task, data }: { task: Task; data: AppData }) {
  const { goToTask } = useTaskUi();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const related = task.relatedTaskIds
    .map((id) => data.tasks.find((t) => t.id === id))
    .filter((t): t is Task => t !== undefined);
  const needle = query.trim().toLocaleLowerCase("ru");
  const matches = needle
    ? data.tasks
        .filter((t) => t.id !== task.id && !task.relatedTaskIds.includes(t.id) && t.title.toLocaleLowerCase("ru").includes(needle))
        .slice(0, 8)
    : [];
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500">Связь видна в обеих задачах и не влияет на прогресс и время.</p>
      {related.length > 0 && (
        <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          {related.map((t) => (
            <li key={t.id} className="flex items-center gap-2 py-1">
              <button type="button" onClick={() => goToTask(t.id)} className="min-w-0 flex-1 text-left hover:text-indigo-600 dark:hover:text-indigo-400" title="Перейти к задаче">
                <span className={`block truncate ${t.status === "done" ? "text-zinc-400 line-through" : ""}`}>{t.title}</span>
                <span className="block truncate text-xs text-zinc-500">{pathOf(data, t)}</span>
              </button>
              <button type="button" onClick={() => unlinkTasks(task.id, t.id)} aria-label={`Убрать связь с задачей «${t.title}»`} title="Убрать связь" className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        value={query}
        placeholder="Найти задачу, чтобы связать"
        aria-label="Найти задачу, чтобы связать"
        onChange={(e) => {
          setQuery(e.target.value);
          setError(null);
        }}
        className={`${fieldClass} w-full`}
      />
      {needle && matches.length === 0 && <p className="text-xs text-zinc-500">Ничего не найдено.</p>}
      {matches.length > 0 && (
        <ul className="space-y-0.5 text-sm">
          {matches.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  const result = linkTasks(task.id, t.id);
                  setError(result);
                  if (result === null) setQuery("");
                }}
                className="w-full rounded-md px-2 py-1 text-left hover:bg-zinc-200 dark:hover:bg-zinc-800"
              >
                <span className="block truncate">{t.title}</span>
                <span className="block truncate text-xs text-zinc-500">{pathOf(data, t)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
