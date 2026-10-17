"use client";

import { useSyncExternalStore } from "react";

// Общие «часы» для идущего таймера: одно обновление в секунду на всё приложение.
// В фоновой вкладке браузер сам замедляет таймеры (примерно до раза в минуту).

let now = 0;
let intervalId: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    now = Date.now();
    intervalId = setInterval(() => {
      now = Date.now();
      for (const l of listeners) l();
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(intervalId);
      // Без подписчиков время не обновляется — следующий подписчик возьмёт свежее
      now = 0;
    }
  };
}

function getSnapshot() {
  if (now === 0) now = Date.now();
  return now;
}

// На сервере времени нет — 0; компоненты с часами рисуются только в браузере
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
