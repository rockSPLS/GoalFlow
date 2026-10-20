"use client";

import { createContext, useContext } from "react";
import type { AppData, Task } from "@/lib/model";

// Общее состояние списков задач: какая карточка открыта (одна на всё приложение)
// и переход к задаче (например, к связанной) — экран её цели или проекта с открытой карточкой.

// Открытая карточка запоминается вместе с признаком «выполнена»: когда задача уходит
// в выполненные (или возвращается), карточка закрывается и сама потом не открывается
export type OpenTask = { id: string; done: boolean } | null;

// Последний переход к задаче: номер нужен, чтобы прокрутить к ней один раз
export type TaskNav = { id: string; seq: number } | null;

export type TaskUi = {
  openTask: OpenTask;
  toggleTask: (task: Task) => void;
  goToTask: (taskId: string) => void;
  // Статус поменяли не из карточки — карточка этой задачи (если открыта) остаётся открытой
  syncOpen: (taskId: string, done: boolean) => void;
  nav: TaskNav;
};

export const TaskUiContext = createContext<TaskUi>({
  openTask: null,
  toggleTask: () => {},
  goToTask: () => {},
  syncOpen: () => {},
  nav: null,
});

export function useTaskUi(): TaskUi {
  return useContext(TaskUiContext);
}

export function isTaskOpen(openTask: OpenTask, task: Task): boolean {
  return openTask !== null && openTask.id === task.id && openTask.done === (task.status === "done");
}

export const PRIORITY_COLORS = {
  high: "text-red-600 dark:text-red-400",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-sky-600 dark:text-sky-400",
} as const;

// Где лежит задача: «Цель: проект», «Цель», «Проект» (без цели) или «Неразобранные»
export function pathOf(data: AppData, task: Task): string {
  if (task.projectId !== null) {
    const project = data.projects.find((p) => p.id === task.projectId);
    const goal = project?.goalId ? data.goals.find((g) => g.id === project.goalId) : undefined;
    return goal ? `${goal.title}: ${project?.title ?? ""}` : (project?.title ?? "");
  }
  if (task.goalId !== null) return data.goals.find((g) => g.id === task.goalId)?.title ?? "";
  return "Неразобранные";
}
