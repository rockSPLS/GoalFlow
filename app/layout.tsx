import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { themeScript } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

const description = "Задачи, цели и учёт времени в одном месте. Данные хранятся в вашем браузере.";

export const metadata: Metadata = {
  // Адрес сайта: из него собираются полные ссылки на картинку превью (og:image) —
  // относительную ссылку мессенджеры не найдут
  metadataBase: new URL("https://goal-flow-planner.vercel.app"),
  title: "GoalFlow",
  description,
  // Превью ссылки: название и подпись под картинкой (картинка — app/opengraph-image.tsx)
  openGraph: { title: "GoalFlow", description, type: "website", locale: "ru_RU" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: скрипт темы меняет data-theme до того, как React «оживит» страницу
    <html
      lang="ru"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
