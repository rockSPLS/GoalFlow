"use client";

import { useRef, useState } from "react";
import { Archive, Download, Upload } from "lucide-react";
import { exportJson, exportTimeCsv, readBackupFile } from "@/lib/backup";
import { currentData, replaceAllData, type Copies } from "@/lib/store";

// Резервная копия: экспорт JSON и CSV, восстановление из JSON, переход в «Хранилище копий»

const buttonClass =
  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/60";

type Props = {
  copies: Copies;
  // Открыт ли сейчас экран «Хранилище копий» и как его открыть
  copiesOpen: boolean;
  onOpenCopies: () => void;
};

export function BackupControls({ copies, copiesOpen, onOpenCopies }: Props) {
  const copiesCount = (copies.beforeImport !== null ? 1 : 0) + (copies.broken !== null ? 1 : 0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setError(null);
    const result = await readBackupFile(file);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    const { goals, tasks, timeEntries } = result.data;
    const timerNote = currentData().timer ? " Идущий сейчас таймер будет остановлен без записи времени (он вернётся, если отменить восстановление)." : "";
    const ok = window.confirm(
      `Заменить все текущие данные данными из файла «${file.name}»? В файле: целей — ${goals.length}, задач — ${tasks.length}, записей времени — ${timeEntries.length}. Текущие данные будут сохранены в копию в хранилище браузера.${timerNote}`,
    );
    if (!ok) return;
    const failure = replaceAllData(result.data);
    if (failure) setError(failure);
  };

  return (
    <section aria-labelledby="backup-heading">
      <h2 id="backup-heading" className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Резервная копия
      </h2>
      <button type="button" onClick={() => exportJson(currentData())} className={buttonClass}>
        <Download size={16} className="shrink-0" aria-hidden="true" />
        Скачать копию (JSON)
      </button>
      <button type="button" onClick={() => exportTimeCsv(currentData())} className={buttonClass}>
        <Download size={16} className="shrink-0" aria-hidden="true" />
        Время для Excel (CSV)
      </button>
      <button type="button" onClick={() => fileInput.current?.click()} className={buttonClass}>
        <Upload size={16} className="shrink-0" aria-hidden="true" />
        Восстановить из копии
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Сброс, чтобы тот же файл можно было выбрать ещё раз
          e.target.value = "";
          if (file) void onFile(file);
        }}
      />
      {error && (
        <p role="alert" className="px-2 pt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onOpenCopies}
        aria-current={copiesOpen ? "page" : undefined}
        className={`${buttonClass} ${copiesOpen ? "bg-zinc-200 font-medium dark:bg-zinc-800" : ""}`}
      >
        <Archive size={16} className="shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate">Хранилище копий</span>
        {copiesCount > 0 && (
          <span className="text-xs text-zinc-500">
            <span className="sr-only">, копий: </span>
            {copiesCount}
          </span>
        )}
      </button>
    </section>
  );
}
