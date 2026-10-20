import { dayDate, PRIORITIES, TAG_MAX, TITLE_MAX, WEIGHTS, type Priority, type Weight } from "./model";
import { addDays, startOfDay, toDateInputValue } from "./time";

// Быстрый ввод задачи одной строкой: название и метки со значками.
//   #тег          — тег (из слова без пробелов; тег с пробелами выбирается из подсказок)
//   !1 !2 !3      — приоритет: высокий / средний / низкий
//   ^дата         — дедлайн: сегодня, завтра, послезавтра, пн…вс (или полностью), 25.10, 25.10.2026
//   3sp           — оценка в story points (1, 2, 3, 5, 8)
//   @…            — цель или проект: выбирается из подсказок; набранное вручную должно совпасть с названием
//                   (название из нескольких слов узнаётся по списку названий spaceNames)
// Обычные слова никогда не считаются метками.

export type QuickDraft = {
  title: string;
  tags: string[];
  priority: Priority | null;
  deadline: string | null;
  weight: Weight | null;
  // Набранные вручную «@…» (с продолжением из нескольких слов) — их сопоставляет с целями и проектами поле ввода
  spaceTokens: string[];
  errors: string[];
};

const PRIORITY_BY_DIGIT: Record<string, Priority> = { "1": PRIORITIES[0], "2": PRIORITIES[1], "3": PRIORITIES[2] };

// Дни недели: сокращение и формы полного названия (в том числе «в среду»)
const WEEKDAY_WORDS: [number, string[]][] = [
  [1, ["пн", "понедельник"]],
  [2, ["вт", "вторник"]],
  [3, ["ср", "среда", "среду"]],
  [4, ["чт", "четверг"]],
  [5, ["пт", "пятница", "пятницу"]],
  [6, ["сб", "суббота", "субботу"]],
  [0, ["вс", "воскресенье"]],
];

// Дата из слова после «^» по отношению к сегодняшнему дню; null — не распознана.
// День недели — ближайший такой день, включая сегодня. Дата без года — ближайшая впереди
// (25.10 в ноябре — это 25 октября следующего года).
export function parseDeadline(word: string, now: Date): string | null {
  const w = word.trim().toLocaleLowerCase("ru");
  const today = startOfDay(now);
  if (w === "сегодня") return toDateInputValue(today);
  if (w === "завтра") return toDateInputValue(addDays(today, 1));
  if (w === "послезавтра") return toDateInputValue(addDays(today, 2));
  for (const [day, words] of WEEKDAY_WORDS) {
    if (words.includes(w)) return toDateInputValue(addDays(today, (day - today.getDay() + 7) % 7));
  }
  const m = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{2}|\d{4}))?$/.exec(w);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = m[3] === undefined ? today.getFullYear() : Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
  const pad = (n: number) => String(n).padStart(2, "0");
  let value = `${year}-${pad(month)}-${pad(day)}`;
  // Проверка той же схемой, что при сохранении: 31.02 и 00.13 не пройдут
  if (!dayDate.safeParse(value).success) return null;
  if (m[3] === undefined && value < toDateInputValue(today)) {
    year += 1;
    value = `${year}-${pad(month)}-${pad(day)}`;
    if (!dayDate.safeParse(value).success) return null;
  }
  return value;
}

export function parseQuickAdd(text: string, now: Date, spaceNames: string[] = []): QuickDraft {
  const draft: QuickDraft = { title: "", tags: [], priority: null, deadline: null, weight: null, spaceTokens: [], errors: [] };
  const words: string[] = [];
  const once = (label: string, already: boolean, token: string) => {
    if (already) draft.errors.push(`${label} указан дважды (${token}) — оставьте один.`);
    return !already;
  };
  const tokens = text.split(/\s+/).filter(Boolean);
  const names = new Set(spaceNames.map((n) => n.replace(/\s+/g, " ").trim().toLocaleLowerCase("ru")));
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const marker = token[0];
    const rest = token.slice(1);
    if (marker === "#" && rest) {
      if (rest.length > TAG_MAX) draft.errors.push(`Тег «${rest}» длиннее ${TAG_MAX} символов.`);
      else if (!draft.tags.some((t) => t.toLocaleLowerCase("ru") === rest.toLocaleLowerCase("ru"))) draft.tags.push(rest);
    } else if (marker === "!" && /^[123]$/.test(rest)) {
      if (once("Приоритет", draft.priority !== null, token)) draft.priority = PRIORITY_BY_DIGIT[rest];
    } else if (marker === "^" && rest) {
      const date = parseDeadline(rest, now);
      if (date === null) draft.errors.push(`Дата «${token}» не распознана: сегодня, завтра, пн…вс или 25.10.`);
      else if (once("Дедлайн", draft.deadline !== null, token)) draft.deadline = date;
    } else if (/^\d+sp$/i.test(token)) {
      const value = Number(token.slice(0, -2));
      const weight = WEIGHTS.find((w) => w === value);
      if (weight === undefined) draft.errors.push(`Оценка «${token}» — бывает 1, 2, 3, 5 или 8 SP.`);
      else if (once("Оценка", draft.weight !== null, token)) draft.weight = weight;
    } else if (marker === "@" && rest) {
      // Самое длинное продолжение из следующих слов, совпадающее с названием цели или проекта
      let take = 0;
      for (let n = tokens.length - i - 1; n >= 1; n--) {
        if (names.has([rest, ...tokens.slice(i + 1, i + 1 + n)].join(" ").toLocaleLowerCase("ru"))) {
          take = n;
          break;
        }
      }
      draft.spaceTokens.push([rest, ...tokens.slice(i + 1, i + 1 + take)].join(" "));
      i += take;
    } else {
      words.push(token);
    }
  }
  draft.title = words.join(" ");
  if (draft.title.length > TITLE_MAX) draft.errors.push(`Название — не длиннее ${TITLE_MAX} символов.`);
  return draft;
}
