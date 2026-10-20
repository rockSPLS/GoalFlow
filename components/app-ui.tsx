"use client";

import { createContext, useContext } from "react";
import type { AppData, Parent, Status } from "@/lib/model";
import type { Selection } from "./AppShell";

// Действия уровня приложения, доступные из любых компонентов: сообщения внизу экрана,
// окно быстрого ввода, палитра команд, шпаргалка по клавишам, переход по экранам.

export type Toast =
  // Задача ушла в другое пространство: ссылки на задачу и на пространство
  | { kind: "added"; taskId: string; title: string; space: Selection; spaceLabel: string }
  // Отметка выполнения горячей клавишей — с отменой (вернуть прежний статус)
  | { kind: "status"; taskId: string; text: string; undoStatus: Status }
  | { kind: "info"; text: string };

export type AppUi = {
  notify: (toast: Toast | null) => void;
  openQuickAdd: (text?: string) => void;
  openPalette: () => void;
  openHelp: () => void;
  select: (selection: Selection) => void;
};

export const AppUiContext = createContext<AppUi>({
  notify: () => {},
  openQuickAdd: () => {},
  openPalette: () => {},
  openHelp: () => {},
  select: () => {},
});

export function useAppUi(): AppUi {
  return useContext(AppUiContext);
}

// Пространство, куда попадает задача, — экран и подпись: «Неразобранные», «Цель», «Цель: проект» или «Проект»
export function spaceOf(data: AppData, parent: Parent): { selection: Selection; label: string } {
  if (parent.kind === "project") {
    const project = data.projects.find((p) => p.id === parent.id);
    const goal = project?.goalId ? data.goals.find((g) => g.id === project.goalId) : undefined;
    return { selection: { kind: "project", id: parent.id }, label: goal ? `${goal.title}: ${project?.title ?? ""}` : (project?.title ?? "") };
  }
  if (parent.kind === "goal") {
    return { selection: { kind: "goal", id: parent.id }, label: data.goals.find((g) => g.id === parent.id)?.title ?? "" };
  }
  return { selection: { kind: "inbox" }, label: "Неразобранные" };
}

export function sameParent(a: Parent, b: Parent): boolean {
  return a.kind === b.kind && ("id" in a ? a.id : "") === ("id" in b ? b.id : "");
}

// Куда по умолчанию попадает новая задача на этом экране: открытая цель или проект, иначе «Неразобранные»
export function defaultParentOf(selection: Selection): Parent {
  if (selection.kind === "goal" || selection.kind === "project") return { kind: selection.kind, id: selection.id };
  return { kind: "inbox" };
}
