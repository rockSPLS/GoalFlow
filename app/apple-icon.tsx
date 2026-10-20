import { ImageResponse } from "next/og";
import { ICON_DOT, ICON_W_PATH, LOGO_COLOR } from "@/components/Logo";

// Значок для главного экрана iPhone и iPad («На экран Домой»): PNG 180×180.
// Квадрат без скруглений и без прозрачности — углы iOS скругляет сама,
// а прозрачное заливает чёрным. Next.js собирает картинку при сборке.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: LOGO_COLOR }}>
        <svg width="180" height="180" viewBox="0 0 24 24">
          <path
            d={ICON_W_PATH}
            fill="none"
            stroke="#fff"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={ICON_DOT.cx} cy={ICON_DOT.cy} r={ICON_DOT.r} fill="#fff" />
        </svg>
      </div>
    ),
    size,
  );
}
