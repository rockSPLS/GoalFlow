import { DEFAULT_WEIGHT, type AppData, type Task } from "./model";

export type Progress = {
  doneWeight: number;
  totalWeight: number;
  percent: number;
  taskCount: number;
};

// Прогресс по весу: вес выполненных задач / вес всех задач.
// «На проверке» считается невыполненной — в прогресс идёт только «Готово».
export function progressOf(tasks: Task[]): Progress {
  let doneWeight = 0;
  let totalWeight = 0;
  for (const t of tasks) {
    const w = t.weight ?? DEFAULT_WEIGHT;
    totalWeight += w;
    if (t.status === "done") doneWeight += w;
  }
  // Округление вниз: 100 % показываем, только когда готово всё
  const percent = totalWeight === 0 ? 0 : Math.floor((doneWeight / totalWeight) * 100);
  return { doneWeight, totalWeight, percent, taskCount: tasks.length };
}

// Задачи цели: привязанные к ней напрямую и задачи её проектов.
// Связанные задачи (relatedTaskIds) на цифры цели не влияют.
export function goalTasks(data: AppData, goalId: string): Task[] {
  const projectIds = new Set(data.projects.filter((p) => p.goalId === goalId).map((p) => p.id));
  return data.tasks.filter(
    (t) => t.goalId === goalId || (t.projectId !== null && projectIds.has(t.projectId)),
  );
}

export function projectTasks(data: AppData, projectId: string): Task[] {
  return data.tasks.filter((t) => t.projectId === projectId);
}

export function inboxTasks(data: AppData): Task[] {
  return data.tasks.filter((t) => t.projectId === null && t.goalId === null);
}
