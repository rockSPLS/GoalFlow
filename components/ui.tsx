"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { TITLE_MAX } from "@/lib/model";
import type { Progress } from "@/lib/progress";

// Мелкие общие элементы интерфейса

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900";

type TextInputProps = {
  placeholder: string;
  ariaLabel: string;
  onSubmit: (value: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
};

// Поле ввода: Enter — добавить, Esc — отменить
export function TextInput({ placeholder, ariaLabel, onSubmit, onCancel, autoFocus }: TextInputProps) {
  const [value, setValue] = useState("");
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      maxLength={TITLE_MAX}
      className={inputClass}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Enter") {
          const clean = value.trim();
          if (clean) {
            onSubmit(clean);
            setValue("");
          }
        } else if (e.key === "Escape") {
          setValue("");
          onCancel?.();
        }
      }}
      onBlur={() => {
        if (!value.trim()) onCancel?.();
      }}
    />
  );
}

// Кнопка «+ …», которая превращается в поле ввода
export function AddInline({ label, onSubmit }: { label: string; onSubmit: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <Plus size={16} aria-hidden="true" />
        {label}
      </button>
    );
  }
  return (
    <TextInput
      autoFocus
      placeholder={label}
      ariaLabel={label}
      onSubmit={(value) => {
        onSubmit(value);
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}

// Заголовок, который переименовывается по клику
export function EditableTitle({ value, onSave, label }: { value: string; onSave: (value: string) => void; label: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  if (draft === null) {
    return (
      <h1 className="min-w-0 text-2xl font-semibold tracking-tight">
        <button
          type="button"
          onClick={() => setDraft(value)}
          title="Нажмите, чтобы переименовать"
          className="max-w-full truncate text-left hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          {value}
        </button>
      </h1>
    );
  }
  const finish = (save: boolean) => {
    if (save && draft.trim()) onSave(draft);
    setDraft(null);
  };
  return (
    <input
      autoFocus
      value={draft}
      maxLength={TITLE_MAX}
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Enter") finish(true);
        else if (e.key === "Escape") finish(false);
      }}
      onBlur={() => finish(true)}
      className={`${inputClass} text-xl font-semibold`}
    />
  );
}

export function ProgressBar({ progress, label }: { progress: Progress; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
      >
        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${progress.percent}%` }} />
      </div>
      <span className="shrink-0 text-sm text-zinc-500">
        {progress.percent}% · {progress.doneWeight} из {progress.totalWeight} SP
      </span>
    </div>
  );
}
