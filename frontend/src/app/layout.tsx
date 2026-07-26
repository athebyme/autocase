import type { Metadata, Viewport } from "next";
import { Montserrat, Unbounded } from "next/font/google";

import { CommandPalette } from "@/components/command-palette";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
});

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-unbounded",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Автокейс Запчасти — интернет-магазин автозапчастей",
    template: "%s · Автокейс Запчасти",
  },
  description:
    "Автозапчасти в наличии и под заказ. Поиск по артикулу и OEM-номеру, актуальные цены, сроки поставки и оформление заказа онлайн.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#191919" },
  ],
};

/* Тему ставим до первой отрисовки, иначе на тёмной теме мигнёт светлый фон. */
const themeBootstrap = `
(function () {
  try {
    var saved = localStorage.getItem("autocase-theme");
    document.documentElement.setAttribute("data-theme", saved || "light");
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${montserrat.variable} ${unbounded.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-dvh antialiased">
        <Providers>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
          <CommandPalette />
        </Providers>
      </body>
    </html>
  );
}
