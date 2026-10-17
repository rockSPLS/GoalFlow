"use client";

import { useState } from "react";
import { downloadText, exportPreviousJson } from "@/lib/backup";
import {
  brokenDataRaw,
  deleteBrokenCopy,
  deleteImportBackup,
  importBackupData,
  importBackupRaw,
  undoImport,
  type Copies,
} from "@/lib/store";
import { formatDay, formatTime, toDateInputValue } from "@/lib/time";

// Копии данных в хранилище браузера: «до восстановления» и «повреждённые данные».
// Кнопки для копии до восстановления есть и в сообщении после восстановления, и в «Хранилище копий».

// Исправная копия скачивается обычной резервной копией (из неё можно восстановить).
// Испорченная — как есть: это данные пользователя, пусть будут у неё на диске.
function downloadPrevious(): string | null {
  const previous = importBackupData();
  if (previous !== null) {
    exportPreviousJson(previous);
    return null;
  }
  const raw = importBackupRaw();
  if (raw === null) return "Копия прежних данных не найдена.";
  downloadText(`goalflow-before-restore-damaged-${toDateInputValue(new Date())}.json`, raw);
  return null;
}

// Отмена восстановления с подтверждением. Возвращает текст ошибки или null.
function undoWithConfirm(): string | null {
  // Испорченную копию проверяем до вопроса «вернуть?» — вернуть из неё всё равно нельзя
  if (importBackupData() === null && importBackupRaw() !== null) {
    if (
      window.confirm(
        "Копия прежних данных повреждена, вернуть из неё данные нельзя. Удалить её? Чтобы сначала скачать её, нажмите «Отмена», затем кнопку скачивания.",
      )
    ) {
      deleteImportBackup();
    }
    return null;
  }
  if (
    !window.confirm(
      "Вернуть данные, которые были до восстановления? Текущие данные будут заменены — всё, что изменено после восстановления, пропадёт.",
    )
  ) {
    return null;
  }
  const result = undoImport();
  return result === "broken" ? "Копия прежних данных повреждена." : result;
}

// Две кнопки в сообщении после восстановления
export function ImportUndoButtons({ className }: { className: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" onClick={() => setError(downloadPrevious())} className={className}>
        Скачать прежние данные
      </button>
      <button type="button" onClick={() => setError(undoWithConfirm())} className={className}>
        Отменить восстановление
      </button>
      {error && (
        <p role="alert" className="w-full text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </>
  );
}

function savedLabel(at: string): string {
  if (!at) return "дата неизвестна";
  const date = new Date(at);
  return `сохранена ${formatDay(date)} в ${formatTime(date)}`;
}

const actionClass =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

// Экран «Хранилище копий»: список временных копий в этом браузере и пояснение
export function CopiesView({ copies }: { copies: Copies }) {
  const [error, setError] = useState<string | null>(null);
  const broken = copies.broken;
  const empty = copies.beforeImport === null && broken === null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Хранилище копий</h1>
        <p className="text-sm text-zinc-500">
          Копии хранятся в этом браузере временно: новая копия того же вида заменяет старую, а при очистке данных сайта копии
          пропадают. Чтобы сохранить надолго — скачайте файл.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-500">
          <li>
            <span className="text-zinc-700 dark:text-zinc-300">Данные до восстановления</span> — сохраняются перед каждым
            восстановлением из файла, чтобы его можно было отменить.
          </li>
          <li>
            <span className="text-zinc-700 dark:text-zinc-300">Повреждённые данные</span> — сохраняются, если данные в
            браузере не прошли проверку при загрузке (бывает редко: ручная правка, расширение браузера, несовместимая
            версия приложения). Вернуть их нельзя, но файл можно поправить вручную или показать специалисту.
          </li>
        </ul>
      </div>

      {empty && <p className="text-sm text-zinc-500">Копий нет.</p>}

      <ul className="space-y-3">
        {copies.beforeImport !== null && (
          <li className="space-y-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div>
              <p className="font-medium">Данные до восстановления</p>
              <p className="text-sm text-zinc-500">Копия {savedLabel(copies.beforeImport)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setError(downloadPrevious())} className={actionClass}>
                Скачать
              </button>
              <button type="button" onClick={() => setError(undoWithConfirm())} className={actionClass}>
                Вернуть
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Удалить копию данных до восстановления? Вернуть их после этого будет нельзя.")) {
                    setError(null);
                    deleteImportBackup();
                  }
                }}
                className={actionClass}
              >
                Удалить
              </button>
            </div>
          </li>
        )}
        {broken !== null && (
          <li className="space-y-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div>
              <p className="font-medium">Повреждённые данные</p>
              <p className="text-sm text-zinc-500">Копия {savedLabel(broken.at)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const raw = brokenDataRaw(broken.key);
                  if (raw === null) setError("Копия повреждённых данных не найдена.");
                  else downloadText(`goalflow-damaged-${toDateInputValue(new Date())}.json`, raw);
                }}
                className={actionClass}
              >
                Скачать
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Удалить копию повреждённых данных? Восстановить её после этого будет нельзя.")) {
                    setError(null);
                    deleteBrokenCopy();
                  }
                }}
                className={actionClass}
              >
                Удалить
              </button>
            </div>
          </li>
        )}
      </ul>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
