import Link from "next/link";

import { PartArt } from "@/components/part-art";
import { SearchField } from "@/components/search-field";

/** Живые примеры из каталога: дают попробовать поиск, не выдумывая номер. */
const POPULAR = [
  { code: "PH5883", name: "Фильтр масляный", brand: "Fram" },
  { code: "GDB1330", name: "Колодки тормозные", brand: "TRW" },
  { code: "BKR6E-11", name: "Свеча зажигания", brand: "NGK" },
  { code: "6PK1053", name: "Ремень поликлиновой", brand: "Gates" },
  { code: "341255", name: "Амортизатор передний", brand: "KYB" },
  { code: "DF4050", name: "Диск тормозной", brand: "TRW" },
];

export default function HomePage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-rule">
        <div className="grid-paper pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-accent" aria-hidden />

        <div className="relative mx-auto max-w-4xl px-4 pt-16 pb-16 text-center sm:px-6 sm:pt-24 sm:pb-20">
          <h1 className="text-[clamp(2.5rem,8vw,5.5rem)] leading-[0.9] font-black tracking-[-0.04em] uppercase">
            Запчасти
            <br />
            <span className="text-accent">по номеру детали</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base text-muted sm:text-lg">
            Введите номер с упаковки или из документов — покажем, где деталь есть, сколько стоит и
            когда приедет.
          </p>

          <div className="mx-auto mt-9 max-w-2xl text-left">
            <SearchField />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Часто ищут</h2>

        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {POPULAR.map((item) => (
            <li key={item.code}>
              <Link
                href={`/search?q=${encodeURIComponent(item.code)}`}
                className="group flex h-full flex-col items-center gap-3 border border-rule bg-surface/40 p-4 text-center transition-all hover:-translate-y-0.5 hover:border-accent hover:bg-surface"
              >
                <PartArt
                  name={item.name}
                  className="h-14 w-14 transition-transform group-hover:scale-105"
                />
                <span className="text-sm leading-tight font-medium">{item.name}</span>
                <span className="num mt-auto text-[0.6875rem] text-faint">{item.code}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
