"use client";

import { useState } from "react";
import { Trash } from "lucide-react";
import type { AppData, Goal, Project, TaskFilter } from "@/lib/model";
import { filterTasks, isEmptyFilter, READY_VIEWS, sameFilter, todayKey } from "@/lib/filters";
import { goalTasks, inboxTasks, progressOf, projectTasks } from "@/lib/progress";
import {
  addProject,
  addTask,
  deleteGoal,
  deleteProject,
  deleteView,
  renameGoal,
  renameProject,
  setProjectGoal,
} from "@/lib/store";
import { formatMinutes, minutesForTasks } from "@/lib/time";
import { CalendarView } from "./CalendarView";
import { FilterPanel } from "./FilterPanel";
import { TaskList } from "./TaskList";
import { AddInline, EditableTitle, ProgressBar, TextInput } from "./ui";
import type { Selection } from "./AppShell";

// Экраны основной области: «Неразобранные», «Все», цель, проект

// Потраченное время по набору задач
function spentText(data: AppData, tasks: { id: string }[]) {
  return formatMinutes(minutesForTasks(data, new Set(tasks.map((t) => t.id))));
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="shrink-0 rounded-md p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
    >
      <Trash size={18} aria-hidden="true" />
    </button>
  );
}

export function InboxView({ data }: { data: AppData }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Неразобранные</h1>
        <p className="text-sm text-zinc-500">Задачи без цели и проекта. Разложить их можно в карточке задачи.</p>
      </div>
      <TextInput placeholder="Новая задача — Enter, чтобы добавить" ariaLabel="Новая задача" onSubmit={(t) => addTask(t, { kind: "inbox" })} />
      <TaskList tasks={inboxTasks(data)} data={data} emptyText="Неразобранных задач нет." />
    </div>
  );
}

function modeClass(active: boolean) {
  return `px-3 py-1.5 text-sm ${
    active ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
  }`;
}

// Все задачи одним списком или календарём; у каждой видно, где она лежит.
// Условия фильтра действуют и на список, и на календарь; готовый или сохранённый вид — те же условия под именем.
export function AllTasksView({ data, filter, onFilter }: { data: AppData; filter: TaskFilter; onFilter: (f: TaskFilter) => void }) {
  const [mode, setMode] = useState<"list" | "calendar">("list");
  const tasks = filterTasks(data, data.tasks, filter, todayKey());
  const ready = READY_VIEWS.find((v) => sameFilter(v.filter, filter));
  // Сохранённый вид можно удалить, даже если его условия совпали с готовым (например, после восстановления из файла)
  const saved = data.views.find((v) => sameFilter(v.filter, filter));
  const viewName = ready?.name ?? saved?.name;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">{viewName ?? "Все задачи"}</h1>
            {saved && (
              <DeleteButton
                label="Удалить вид"
                onClick={() => {
                  if (window.confirm(`Удалить вид «${saved.name}»? Задачи останутся.`)) deleteView(saved.id);
                }}
              />
            )}
          </div>
          <p className="text-sm text-zinc-500">
            {viewName ? "Задачи по условиям вида." : "Задачи из всех целей и проектов."} Новая задача отсюда попадает в «Неразобранные».
          </p>
        </div>
        <div role="group" aria-label="Вид списка" className="flex overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700">
          <button type="button" aria-pressed={mode === "list"} onClick={() => setMode("list")} className={modeClass(mode === "list")}>
            Список
          </button>
          <button type="button" aria-pressed={mode === "calendar"} onClick={() => setMode("calendar")} className={modeClass(mode === "calendar")}>
            Календарь
          </button>
        </div>
      </div>
      <FilterPanel data={data} filter={filter} onFilter={onFilter} />
      <TextInput placeholder="Новая задача — Enter, чтобы добавить" ariaLabel="Новая задача" onSubmit={(t) => addTask(t, { kind: "inbox" })} />
      {mode === "list" ? (
        <TaskList
          tasks={tasks}
          data={data}
          emptyText={isEmptyFilter(filter) ? "Задач пока нет." : "Нет задач по этим условиям."}
          showPath
          doneOpen={filter.status === "done"}
        />
      ) : (
        <CalendarView tasks={tasks} data={data} />
      )}
    </div>
  );
}

export function GoalView({ data, goal, onSelect }: { data: AppData; goal: Goal; onSelect: (s: Selection) => void }) {
  const projects = data.projects.filter((p) => p.goalId === goal.id);
  const directTasks = data.tasks.filter((t) => t.goalId === goal.id);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <EditableTitle value={goal.title} label="Название цели" onSave={(t) => renameGoal(goal.id, t)} />
          <DeleteButton
            label="Удалить цель"
            onClick={() => {
              if (window.confirm(`Удалить цель «${goal.title}»? Её проекты и задачи останутся, но без цели.`)) {
                deleteGoal(goal.id);
                onSelect({ kind: "inbox" });
              }
            }}
          />
        </div>
        <ProgressBar progress={progressOf(goalTasks(data, goal.id))} label={`Прогресс цели «${goal.title}»`} />
        <p className="text-sm text-zinc-500">Потрачено: {spentText(data, goalTasks(data, goal.id))}</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-500">Задачи цели без проекта</h2>
        <TextInput
          placeholder="Новая задача цели — Enter, чтобы добавить"
          ariaLabel="Новая задача цели"
          onSubmit={(t) => addTask(t, { kind: "goal", id: goal.id })}
        />
        <TaskList tasks={directTasks} data={data} emptyText="Задач без проекта нет." />
      </section>

      {projects.map((project) => (
        <section key={project.id} className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-sm font-medium">
              <button
                type="button"
                onClick={() => onSelect({ kind: "project", id: project.id })}
                className="hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                Проект: {project.title}
              </button>
            </h2>
            <span className="text-xs text-zinc-500">
              {progressOf(projectTasks(data, project.id)).percent}% · {spentText(data, projectTasks(data, project.id))}
            </span>
          </div>
          <TaskList tasks={projectTasks(data, project.id)} data={data} emptyText="В проекте пока нет задач." />
        </section>
      ))}

      <AddInline
        label="Новый проект в этой цели"
        onSubmit={(title) => {
          const id = addProject(title, goal.id);
          if (id) onSelect({ kind: "project", id });
        }}
      />
    </div>
  );
}

export function ProjectView({ data, project, onSelect }: { data: AppData; project: Project; onSelect: (s: Selection) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-zinc-500">
          Цель:
          <select
            value={project.goalId ?? ""}
            onChange={(e) => setProjectGoal(project.id, e.target.value || null)}
            className="min-w-0 max-w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">без цели</option>
            {data.goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <EditableTitle value={project.title} label="Название проекта" onSave={(t) => renameProject(project.id, t)} />
          <DeleteButton
            label="Удалить проект"
            onClick={() => {
              const where = project.goalId ? "перейдут к цели проекта" : "перейдут в «Неразобранные»";
              if (window.confirm(`Удалить проект «${project.title}»? Его задачи ${where}.`)) {
                deleteProject(project.id);
                onSelect(project.goalId ? { kind: "goal", id: project.goalId } : { kind: "inbox" });
              }
            }}
          />
        </div>
        <ProgressBar progress={progressOf(projectTasks(data, project.id))} label={`Прогресс проекта «${project.title}»`} />
        <p className="text-sm text-zinc-500">Потрачено: {spentText(data, projectTasks(data, project.id))}</p>
      </div>
      <TextInput
        placeholder="Новая задача проекта — Enter, чтобы добавить"
        ariaLabel="Новая задача проекта"
        onSubmit={(t) => addTask(t, { kind: "project", id: project.id })}
      />
      <TaskList tasks={projectTasks(data, project.id)} data={data} emptyText="В проекте пока нет задач." />
    </div>
  );
}
