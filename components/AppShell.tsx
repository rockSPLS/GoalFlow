"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { dismissNotice, useStore } from "@/lib/store";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { GoalView, InboxView, ProjectView } from "./Views";

// Что открыто в основной области
export type Selection = { kind: "inbox" } | { kind: "goal"; id: string } | { kind: "project"; id: string };

export function AppShell() {
  const snapshot = useStore();
  const [selection, setSelection] = useState<Selection>({ kind: "inbox" });
  const [menuOpen, setMenuOpen] = useState(false);

  // На сервере и до чтения localStorage данных ещё нет
  if (snapshot === null) {
    return <p className="p-6 text-sm text-zinc-500">Загрузка…</p>;
  }
  const { data, notice, locked } = snapshot;

  // Если открытую цель или проект удалили (например, в другой вкладке) — показываем «Входящие»
  const goal = selection.kind === "goal" ? data.goals.find((g) => g.id === selection.id) : undefined;
  const project = selection.kind === "project" ? data.projects.find((p) => p.id === selection.id) : undefined;
  const current: Selection = goal || project ? selection : { kind: "inbox" };

  const select = (next: Selection) => {
    setSelection(next);
    setMenuOpen(false);
  };

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 md:hidden dark:border-zinc-800">
        <span className="font-semibold">GoalFlow</span>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Скрыть меню" : "Показать меню"}
            className="rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <aside
        className={`${menuOpen ? "block" : "hidden"} border-b border-zinc-200 bg-zinc-50 p-4 md:block md:w-72 md:shrink-0 md:border-r md:border-b-0 dark:border-zinc-800 dark:bg-zinc-950`}
      >
        <div className="mb-4 hidden items-center justify-between pl-2 md:flex">
          <p className="text-lg font-semibold">GoalFlow</p>
          <ThemeToggle />
        </div>
        <Sidebar data={data} selection={current} onSelect={select} />
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-3xl space-y-4">
          {notice && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <p className="flex-1">{notice}</p>
              {/* Пока запись запрещена, сообщение не скрывается — иначе легко забыть, что ничего не сохраняется */}
              {!locked && (
                <button type="button" onClick={dismissNotice} aria-label="Скрыть сообщение" className="rounded p-1 hover:bg-amber-100 dark:hover:bg-amber-900">
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          {goal ? (
            <GoalView key={goal.id} data={data} goal={goal} onSelect={select} />
          ) : project ? (
            <ProjectView key={project.id} data={data} project={project} onSelect={select} />
          ) : (
            <InboxView data={data} />
          )}
        </div>
      </main>
    </div>
  );
}
