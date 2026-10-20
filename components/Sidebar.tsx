"use client";

import { Clock, Folder, Inbox, List, Target } from "lucide-react";
import { EMPTY_FILTER } from "@/lib/filters";
import type { AppData } from "@/lib/model";
import { goalTasks, inboxTasks, progressOf } from "@/lib/progress";
import { addGoal, addProject } from "@/lib/store";
import { AddInline } from "./ui";
import type { Selection } from "./AppShell";

type Props = {
  data: AppData;
  selection: Selection;
  onSelect: (selection: Selection) => void;
};

function itemClass(active: boolean) {
  return `flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
    active
      ? "bg-zinc-200 font-medium dark:bg-zinc-800"
      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
  }`;
}

export function Sidebar({ data, selection, onSelect }: Props) {
  // Счётчики — только невыполненные задачи
  const openInbox = inboxTasks(data).filter((t) => t.status !== "done").length;
  const openAll = data.tasks.filter((t) => t.status !== "done").length;
  const orphanProjects = data.projects.filter((p) => p.goalId === null);
  const isSelected = (kind: Selection["kind"], id?: string) =>
    selection.kind === kind && ("id" in selection ? selection.id === id : true);

  return (
    <nav aria-label="Навигация" className="space-y-5">
      <section>
        <h2 className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Задачи</h2>
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => onSelect({ kind: "inbox" })}
            aria-current={isSelected("inbox") ? "page" : undefined}
            className={itemClass(isSelected("inbox"))}
          >
            <Inbox size={16} className="shrink-0" aria-hidden="true" />
            <span className="flex-1 truncate">Неразобранные</span>
            {openInbox > 0 && <span className="text-xs text-zinc-500">{openInbox}</span>}
          </button>
          <button
            type="button"
            onClick={() => onSelect({ kind: "all", filter: EMPTY_FILTER })}
            aria-current={isSelected("all") ? "page" : undefined}
            className={itemClass(isSelected("all"))}
          >
            <List size={16} className="shrink-0" aria-hidden="true" />
            <span className="flex-1 truncate">Все</span>
            {openAll > 0 && <span className="text-xs text-zinc-500">{openAll}</span>}
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Цели</h2>
        <ul className="space-y-0.5">
          {data.goals.map((goal) => (
            <li key={goal.id}>
              <button
                type="button"
                onClick={() => onSelect({ kind: "goal", id: goal.id })}
                aria-current={isSelected("goal", goal.id) ? "page" : undefined}
                className={itemClass(isSelected("goal", goal.id))}
              >
                <Target size={16} className="shrink-0 text-indigo-500" aria-hidden="true" />
                <span className="flex-1 truncate">{goal.title}</span>
                <span className="text-xs text-zinc-500">{progressOf(goalTasks(data, goal.id)).percent}%</span>
              </button>
              <ul className="ml-4 space-y-0.5">
                {data.projects
                  .filter((p) => p.goalId === goal.id)
                  .map((project) => (
                    <li key={project.id}>
                      <button
                        type="button"
                        onClick={() => onSelect({ kind: "project", id: project.id })}
                        aria-current={isSelected("project", project.id) ? "page" : undefined}
                        className={itemClass(isSelected("project", project.id))}
                      >
                        <Folder size={16} className="shrink-0 text-zinc-400" aria-hidden="true" />
                        <span className="flex-1 truncate">{project.title}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
        <AddInline
          label="Новая цель"
          onSubmit={(title) => {
            const id = addGoal(title);
            if (id) onSelect({ kind: "goal", id });
          }}
        />
      </section>

      <section>
        <h2 className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Проекты без цели</h2>
        <ul className="space-y-0.5">
          {orphanProjects.map((project) => (
            <li key={project.id}>
              <button
                type="button"
                onClick={() => onSelect({ kind: "project", id: project.id })}
                aria-current={isSelected("project", project.id) ? "page" : undefined}
                className={itemClass(isSelected("project", project.id))}
              >
                <Folder size={16} className="shrink-0 text-zinc-400" aria-hidden="true" />
                <span className="flex-1 truncate">{project.title}</span>
              </button>
            </li>
          ))}
        </ul>
        <AddInline
          label="Новый проект"
          onSubmit={(title) => {
            const id = addProject(title, null);
            if (id) onSelect({ kind: "project", id });
          }}
        />
      </section>

      <button
        type="button"
        onClick={() => onSelect({ kind: "time" })}
        aria-current={isSelected("time") ? "page" : undefined}
        className={itemClass(isSelected("time"))}
      >
        <Clock size={16} className="shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate">Затраты времени</span>
      </button>
    </nav>
  );
}
