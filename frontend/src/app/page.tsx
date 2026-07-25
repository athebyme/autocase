import Link from "next/link";

import { SearchField } from "@/components/search-field";
import { SupplierStatus } from "@/components/supplier-status";
import { CornerFrame, SectionLabel } from "@/components/ui";

/** Примеры из демо-каталога: дают попробовать поиск, не выдумывая артикул. */
const SAMPLES = [
  { code: "PH5883", brand: "Fram", name: "Фильтр масляный" },
  { code: "GDB1330", brand: "TRW", name: "Колодки тормозные, передние" },
  { code: "BKR6E-11", brand: "NGK", name: "Свеча зажигания" },
  { code: "6PK1053", brand: "Gates", name: "Ремень поликлиновой" },
  { code: "341255", brand: "KYB", name: "Амортизатор передний" },
  { code: "DF4050", brand: "TRW", name: "Диск тормозной" },
];

const STEPS = [
  {
    index: "01",
    title: "Артикул",
    body: "Вводите как есть — с дефисами, пробелами или без. Мы сами приведём к нужному виду и повторим поиск, если поставщик не понял написание.",
  },
  {
    index: "02",
    title: "Проценка",
    body: "Спрашиваем всех подключённых поставщиков одновременно и показываем склады, цены, остатки и сроки в одной таблице. Аналоги — отдельным блоком.",
  },
  {
    index: "03",
    title: "Заказ",
    body: "Собираете корзину из предложений разных складов, а мы разносим её по поставщикам и отправляем каждому свою часть.",
  },
];

export default function HomePage() {
  return (
    <div>
      {/* --- Экран поиска ---------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-rule">
        <div className="grid-paper pointer-events-none absolute inset-0 opacity-45" aria-hidden />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-accent"
          aria-hidden
        />

        <div className="relative mx-auto max-w-[104rem] px-4 pt-14 pb-14 sm:px-6 sm:pt-20 sm:pb-16">
          <SectionLabel index="01" aside={<SupplierStatus />}>
            Подбор по артикулу
          </SectionLabel>

          <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
            <div className="min-w-0">
              <h1 className="text-[clamp(2.75rem,9vw,8.5rem)] leading-[0.86] font-black tracking-[-0.045em] uppercase">
                Запчасти
                <br />
                <span className="text-accent">по номеру</span>
                <br />
                детали
              </h1>

              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                Один ввод — и вы видите, у кого из поставщиков деталь есть, почём и когда приедет.
                Вместе с аналогами, кратностью отгрузки и транзитом.
              </p>
            </div>

            {/* Табличка-спецификация вместо декоративной картинки. */}
            <CornerFrame className="h-fit bg-surface/70 lg:mt-2">
              <dl className="divide-y divide-rule text-sm">
                <Spec term="Источник" value="API поставщиков" />
                <Spec term="Поиск" value="артикул / OEM" />
                <Spec term="Проценка" value="все склады сразу" />
                <Spec term="Аналоги" value="кросс-номера" />
                <Spec term="Сроки" value="в сутках МСК" />
                <Spec term="Быстрый вызов" value="⌘K или /" />
              </dl>
            </CornerFrame>
          </div>

          {/* Поле поиска — во всю ширину: это главный элемент страницы. */}
          <div className="mt-12">
            <SearchField />
          </div>
        </div>
      </section>

      {/* --- Как это работает ------------------------------------------ */}
      <section className="mx-auto max-w-[104rem] px-4 py-16 sm:px-6 sm:py-20">
        <SectionLabel index="02">Как это работает</SectionLabel>

        <div className="mt-8 grid gap-px bg-rule sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.index} className="bg-paper p-6 sm:p-7">
              <span className="num text-[0.6875rem] tracking-[0.2em] text-accent">
                {step.index}
              </span>
              <h3 className="mt-3 text-xl font-bold tracking-tight">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --- Примеры ---------------------------------------------------- */}
      <section className="mx-auto max-w-[104rem] px-4 pb-8 sm:px-6">
        <SectionLabel index="03" aside="кликните, чтобы открыть проценку">
          Попробовать на примере
        </SectionLabel>

        <ul className="mt-8 grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLES.map((sample) => (
            <li key={sample.code}>
              <Link
                href={`/search?q=${encodeURIComponent(sample.code)}`}
                className="group flex items-baseline gap-4 bg-paper px-5 py-4 transition-colors hover:bg-surface"
              >
                <span className="num w-28 shrink-0 text-sm font-medium tracking-[0.04em] group-hover:text-accent">
                  {sample.code}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{sample.name}</span>
                  <span className="num mt-0.5 block text-[0.625rem] tracking-[0.12em] text-faint uppercase">
                    {sample.brand}
                  </span>
                </span>
                <span aria-hidden className="text-faint transition-transform group-hover:translate-x-1 group-hover:text-accent">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Spec({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <dt className="text-[0.6875rem] tracking-[0.1em] text-faint uppercase">{term}</dt>
      <dd className="num text-xs text-ink">{value}</dd>
    </div>
  );
}
