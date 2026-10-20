import type { CSSProperties } from "react";

// Логотип GoalFlow: слово «GoalFlo» шрифтом приложения и рукописная «w» —
// две галки, как от маркера, вторая уходит дугой к точке-цели.
// Рисунок w — в сетке 34×46: базовая линия на y=31, верх строчных букв на y=10,
// поэтому w ставится в строку как буква (высота 1.15em, сдвиг вниз 0.225em).

// Значок вкладки — упрощённая w в квадрате 24×24: в 16 px тонкие штрихи пропадают,
// поэтому штрихи ровные. Те же линии — в app/icon.svg (статичный файл, без кода)
// и в app/apple-icon.tsx.
// indigo-500 из Tailwind — основной акцент приложения: кнопка таймера, полосы прогресса, значок цели
export const LOGO_COLOR = "#615fff";
export const ICON_W_PATH = "M4.9 9.7 L7.8 19.5 Q8.4 13.9 11.5 9.2 M9.8 9.7 L12.7 19.5 Q13.4 13.3 16.8 8.2";
export const ICON_DOT = { cx: 19, cy: 4.9, r: 1.6 };

// Размер w относительно шрифта (в em). Те же числа — в классах Wordmark ниже
// (Tailwind требует их буквально).
export const W_EM = { width: 0.85, height: 1.15 };

type LogoWProps = {
  // Цвет w; по умолчанию — цвет текста (currentColor)
  color?: string;
  className?: string;
  style?: CSSProperties;
  // Размер в пикселях — для картинки превью: генератор берёт размер svg из атрибутов, а не из style
  width?: number;
  height?: number;
};

// Рукописная w. Левые штрихи — заливка, сужаются кверху; правые — линии с изгибом в одну сторону.
// Вторая галка — копия первой, сдвинутая вправо (её левый штрих чуть выходит за правый штрих
// первой), хвост на десятую часть длиннее — до точки.
// Используется и в интерфейсе, и в картинке превью (там нет CSS-классов — только style).
export function LogoW({ color = "currentColor", className, style, width, height }: LogoWProps) {
  return (
    <svg viewBox="0 -6 34 46" width={width} height={height} className={className} style={style} aria-hidden="true">
      <path d="M1.23 11.22 A0.8 0.8 0 0 1 2.77 10.78 L9.23 29.5 L5.77 30.5 Z" fill={color} />
      <path d="M10.73 11.22 A0.8 0.8 0 0 1 12.27 10.78 L18.73 29.5 L15.27 30.5 Z" fill={color} />
      <path d="M7.5 30 Q8.8 19.14 14.8 10" fill="none" stroke={color} strokeWidth={3.6} strokeLinecap="round" />
      <path d="M17 30 Q18.44 18.06 25.03 8" fill="none" stroke={color} strokeWidth={3.6} strokeLinecap="round" />
      <circle cx={28.43} cy={2.82} r={2.9} fill={color} />
    </svg>
  );
}

// Надпись «GoalFlow» с рукописной w. Размер и толщину букв задаёт className снаружи.
// Экранный диктор читает скрытое слово целиком, а не «GoalFlo» и картинку.
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`shrink-0 whitespace-nowrap ${className}`}>
      {/* select-none: при копировании шапки в буфер попадает только скрытое слово целиком */}
      <span aria-hidden="true" className="select-none">
        GoalFlo
        <LogoW className="inline-block h-[1.15em] w-[0.85em] align-[-0.225em] text-indigo-500" />
      </span>
      <span className="sr-only">GoalFlow</span>
    </span>
  );
}
