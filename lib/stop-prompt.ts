"use client";

import { useSyncExternalStore } from "react";

// Уведомление об остановке таймера. Это состояние интерфейса, а не данные, поэтому оно не сохраняется.
// - "ask": таймер остановили вручную — предлагаем сменить статус задачи;
// - "status": таймер остановился из-за смены статуса — просто сообщаем, статус уже выбран.

export type StopPrompt = { kind: "ask" | "status"; taskId: string; minutes: number };

let prompt: StopPrompt | null = null;
const listeners = new Set<() => void>();

export function currentStopPrompt(): StopPrompt | null {
  return prompt;
}

export function showStopPrompt(value: StopPrompt | null) {
  prompt = value;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStopPrompt(): StopPrompt | null {
  return useSyncExternalStore(
    subscribe,
    () => prompt,
    () => null,
  );
}
