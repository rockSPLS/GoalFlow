"use client";

import { backupSchema, type AppData } from "./model";
import { addDays, entriesBetween, goalIdOfTask, toDateInputValue, formatTime } from "./time";

// Экспорт (JSON — полная копия, CSV — записи времени для Excel) и разбор файла для восстановления

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Ссылку освобождаем после того, как браузер начал скачивание
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// name — начало имени файла: обычная копия или прежние данные (до восстановления)
export function exportJson(data: AppData, name = "goalflow-backup") {
  const backup = { format: "goalflow-backup", exportedAt: new Date().toISOString(), data };
  download(`${name}-${toDateInputValue(new Date())}.json`, JSON.stringify(backup, null, 2), "application/json");
}

// Скачать данные, какими они были перед последним восстановлением — обычной копией, из неё можно восстановить
export function exportPreviousJson(data: AppData) {
  exportJson(data, "goalflow-before-restore");
}

// Скачать текст как есть (например, испорченную копию, которую нельзя оформить как резервную)
export function downloadText(filename: string, content: string) {
  download(filename, content, "application/json");
}

// Ячейка CSV: кавычки удваиваются; значения, с которых Excel начал бы формулу (= + - @),
// получают апостроф, чтобы текст задачи не выполнился как формула
function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Записи времени в CSV: за промежуток [from, to) или за всё время (range не задан)
export function exportTimeCsv(data: AppData, range?: { from: Date; to: Date }) {
  const header = ["Дата", "Начало", "Минуты", "Часы", "Цель", "Проект", "Задача", "Способ"];
  const entries = range ? entriesBetween(data.timeEntries, range.from, range.to) : data.timeEntries;
  const rows = [...entries]
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((e) => {
      const start = new Date(e.start);
      const task = data.tasks.find((t) => t.id === e.taskId);
      const project = task?.projectId ? data.projects.find((p) => p.id === task.projectId) : undefined;
      const goalId = goalIdOfTask(data, e.taskId);
      const goal = goalId ? data.goals.find((g) => g.id === goalId) : undefined;
      return [
        toDateInputValue(start),
        // У ручной записи известен только день — время начала не выдумываем
        e.source === "timer" ? formatTime(start) : "",
        e.minutes,
        // Десятичная запятая — так число поймёт русский Excel
        (e.minutes / 60).toFixed(2).replace(".", ","),
        goal?.title ?? "",
        project?.title ?? "",
        task?.title ?? "",
        e.source === "timer" ? "таймер" : "вручную",
      ];
    });
  // BOM в начале и «;» как разделитель — чтобы русский Excel открыл файл без настройки
  const csv = "\uFEFF" + [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
  // В имени файла — период: «goalflow-time-2026-10-12_2026-10-18.csv» или «goalflow-time-all-2026-10-18.csv»
  const name = range
    ? `${toDateInputValue(range.from)}_${toDateInputValue(addDays(range.to, -1))}`
    : `all-${toDateInputValue(new Date())}`;
  download(`goalflow-time-${name}.csv`, csv, "text/csv;charset=utf-8");
}

// Читает файл резервной копии и проверяет его схемой. Ошибка — понятный текст для пользователя.
export async function readBackupFile(file: File): Promise<{ data: AppData } | { error: string }> {
  if (file.size > MAX_IMPORT_BYTES) return { error: "Файл слишком большой для резервной копии GoalFlow." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { error: "Файл не читается как JSON." };
  }
  const result = backupSchema.safeParse(parsed);
  if (!result.success) return { error: "Это не резервная копия GoalFlow или файл повреждён." };
  // Таймер из файла не восстанавливается: его старт в прошлом, и он показал бы дни работы
  return { data: { ...result.data.data, timer: null } };
}
