"use client";

// Звук напоминания: вибрафон, три ноты ми – соль – до (ми и соль малой октавы, до первой).
// Генерируется кодом (Web Audio API), без файлов.
// Браузеры разрешают звук только после действия пользователя, поэтому звук «разблокируется»
// при первом клике или нажатии клавиши на странице (см. AppShell).

let context: AudioContext | null = null;

// Ноты, Гц: ми малой, соль малой, до первой октавы
const NOTES = [164.81, 196.0, 261.63];
const NOTE_GAP = 0.3; // секунды между нотами
const NOTE_LENGTH = 1.8; // длительность звучания ноты, с
const VOLUME = 0.25;

export async function unlockAudio(): Promise<void> {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") await context.resume();
  } catch {
    // Web Audio недоступен — напоминание останется беззвучным
  }
}

// Одна нота вибрафона: чистый тон с мягкой «волной» громкости (тремоло) и плавным затуханием
function vibraphoneNote(audio: AudioContext, frequency: number, start: number) {
  const oscillator = audio.createOscillator();
  const tremolo = audio.createGain(); // громкость колеблется 0,4…1,0
  const envelope = audio.createGain(); // нарастание и затухание
  const lfo = audio.createOscillator();
  const lfoDepth = audio.createGain();

  oscillator.frequency.value = frequency;
  lfo.frequency.value = 5.5;
  tremolo.gain.value = 0.7;
  lfoDepth.gain.value = 0.3;
  // Плавное нарастание и затухание, чтобы не было щелчков
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(VOLUME, start + 0.02);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + NOTE_LENGTH);

  lfo.connect(lfoDepth).connect(tremolo.gain);
  oscillator.connect(tremolo).connect(envelope).connect(audio.destination);
  oscillator.start(start);
  lfo.start(start);
  oscillator.stop(start + NOTE_LENGTH + 0.02);
  lfo.stop(start + NOTE_LENGTH + 0.02);
}

// Возвращает false, если звук пока заблокирован браузером
export function playChime(): boolean {
  if (context === null || context.state !== "running") return false;
  const t0 = context.currentTime;
  NOTES.forEach((frequency, i) => {
    if (context !== null) vibraphoneNote(context, frequency, t0 + i * NOTE_GAP);
  });
  return true;
}
