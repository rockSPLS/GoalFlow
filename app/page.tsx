// Временная главная страница: каркас проекта. Интерфейс задач появится в следующей итерации.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">GoalFlow</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Каркас приложения готов. Цели, проекты и задачи появятся здесь в следующей итерации.
      </p>
    </main>
  );
}
