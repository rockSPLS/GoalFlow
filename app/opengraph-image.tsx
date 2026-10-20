import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";
import { LOGO_COLOR, LogoW, W_EM } from "@/components/Logo";

// Картинка превью ссылки (Open Graph) — её показывают мессенджеры и соцсети.
// Только надпись, крупно: подпись под картинкой мессенджер берёт из description.
// Фон светлый, как у приложения. Next.js собирает картинку при сборке (см. "use cache" ниже).
export const alt = "GoalFlow";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const WORD = "GoalFlo";
const FONT_SIZE = 168;

// Полужирный Geist, как в шапке приложения. Встроенный шрифт генератора — только обычный,
// поэтому файл берётся с Google Fonts при сборке (только буквы надписи — несколько КБ).
// Не загрузился (ошибка или нет ответа 5 секунд) — надпись выйдет встроенным обычным Geist,
// сборка не падает; полужирный появится при следующей сборке.
// "use cache": без него запрос к Google делает картинку динамической —
// она собиралась бы заново на каждый показ ссылки, а не один раз при сборке.
// Профиль max — шрифт не меняется, обновлять картинку раз в 15 минут незачем.
async function loadGeistSemiBold(): Promise<ArrayBuffer | null> {
  "use cache";
  cacheLife("max");
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Geist:wght@600&text=${encodeURIComponent(WORD)}`;
    const css = await (await fetch(cssUrl, { signal: AbortSignal.timeout(5000) })).text();
    const fontUrl = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    // Берём файл только с сервера шрифтов Google, а не любой адрес из ответа
    if (!fontUrl?.startsWith("https://fonts.gstatic.com/")) return null;
    const font = await fetch(fontUrl, { signal: AbortSignal.timeout(5000) });
    return font.ok ? await font.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const geist = await loadGeistSemiBold();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            fontSize: FONT_SIZE,
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: -4,
            color: "#171717",
          }}
        >
          <span>{WORD}</span>
          <LogoW
            color={LOGO_COLOR}
            width={FONT_SIZE * W_EM.width}
            height={FONT_SIZE * W_EM.height}
            // Сдвиги подобраны по картинке: генератор ставит текст в строку иначе, чем браузер
            style={{
              width: FONT_SIZE * W_EM.width,
              height: FONT_SIZE * W_EM.height,
              marginBottom: FONT_SIZE * -0.045,
              marginLeft: FONT_SIZE * -0.07,
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: geist ? [{ name: "Geist", data: geist, weight: 600, style: "normal" }] : undefined,
    },
  );
}
