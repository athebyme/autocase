import Link from "next/link";

import { PartArt } from "@/components/part-art";
import { PartsLookup } from "@/components/parts-lookup";

const POPULAR = [
  { code: "PH5883", name: "Фильтр масляный", brand: "Fram" },
  { code: "GDB1330", name: "Колодки тормозные", brand: "TRW" },
  { code: "BKR6E-11", name: "Свеча зажигания", brand: "NGK" },
  { code: "6PK1053", name: "Ремень поликлиновой", brand: "Gates" },
  { code: "341255", name: "Амортизатор передний", brand: "KYB" },
  { code: "DF4050", name: "Диск тормозной", brand: "TRW" },
];

const CATALOG = [
  {
    code: "PH5883",
    art: "Фильтр масляный",
    title: "Фильтры",
    items: ["Масляные", "Воздушные", "Салонные", "Топливные"],
  },
  {
    code: "GDB1330",
    art: "Колодки тормозные",
    title: "Тормозная система",
    items: ["Колодки", "Диски", "Суппорты", "Ремкомплекты"],
  },
  {
    code: "BKR6E-11",
    art: "Свеча зажигания",
    title: "Система зажигания",
    items: ["Свечи", "Катушки", "Провода", "Свечи накаливания"],
  },
  {
    code: "341255",
    art: "Амортизатор передний",
    title: "Подвеска и рулевое",
    items: ["Амортизаторы", "Пружины", "Рычаги", "Наконечники"],
  },
  {
    code: "6PK1053",
    art: "Ремень поликлиновой",
    title: "Ремни и привод",
    items: ["Приводные ремни", "Комплекты ГРМ", "Ролики", "Натяжители"],
  },
  {
    code: "DF4050",
    art: "Подшипник ступичный",
    title: "Трансмиссия",
    items: ["Подшипники", "Ступицы", "ШРУСы", "Сцепление"],
  },
];

const BENEFITS = [
  {
    number: "01",
    title: "Точный подбор",
    text: "По артикулу или VIN",
  },
  {
    number: "02",
    title: "Честные сроки",
    text: "Показываем склад и поставку",
  },
  {
    number: "03",
    title: "Удобное получение",
    text: "Самовывоз, курьер или Яндекс Go",
  },
  {
    number: "04",
    title: "Установка в сервисе",
    text: "Проверим деталь до монтажа",
  },
];

export default function HomePage() {
  return (
    <div>
      <h1 className="sr-only">Автокейс Запчасти — интернет-магазин автозапчастей</h1>

      <section className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-7">
        <div className="grid border border-rule-strong lg:grid-cols-[15.5rem_minmax(0,1fr)]">
          <CatalogSidebar />

          <div className="min-w-0">
            <section className="relative min-h-[22rem] overflow-hidden bg-graphite px-6 py-10 text-graphite-ink sm:px-10 sm:py-12">
              <div className="relative z-10 max-w-3xl">
                <p className="text-xs font-bold tracking-[0.12em] text-accent uppercase">
                  Автокейс Запчасти
                </p>
                <h2 className="mt-4 text-3xl font-black leading-[1.08] tracking-[-0.035em] sm:text-4xl">
                  Детали для вашего автомобиля без ошибок в подборе
                </h2>
                <p className="mt-5 max-w-lg text-sm leading-7 text-graphite-ink/70">
                  Ищем по складам поставщиков, сравниваем цены и проверяем применимость
                  перед заказом.
                </p>
                <a
                  href="#parts-search"
                  className="mt-7 inline-flex h-12 items-center bg-accent px-6 text-xs font-bold tracking-[0.06em] text-accent-ink uppercase transition-colors hover:bg-paper hover:text-ink"
                >
                  Найти запчасть
                </a>
              </div>

            </section>

            <section className="border-t border-rule-strong bg-paper p-5 sm:p-7">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold tracking-[0.1em] text-accent uppercase">
                    Поиск и подбор
                  </p>
                  <h2 className="mt-2 text-xl font-black tracking-tight sm:text-2xl">
                    Введите артикул или VIN автомобиля
                  </h2>
                </div>
                <p className="max-w-sm text-xs leading-relaxed text-muted">
                  Покажем цены, наличие и срок доставки. VIN расшифруем до модификации.
                </p>
              </div>
              <PartsLookup />
            </section>
          </div>
        </div>

        <div className="grid border-x border-b border-rule-strong sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((benefit) => (
            <article
              key={benefit.number}
              className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-rule p-4 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-r lg:border-b-0 lg:last:border-r-0"
            >
              <span className="num pt-0.5 text-xs font-bold text-accent">{benefit.number}</span>
              <div>
                <h3 className="text-sm font-bold">{benefit.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">{benefit.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="catalog" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <SectionHeading
          eyebrow="Основные разделы"
          title="Каталог запчастей"
          description="Популярные группы товаров. Если знаете номер детали — быстрее найти её через поиск."
        />

        <div className="mt-7 grid border-t border-l border-rule sm:grid-cols-2 lg:grid-cols-3">
          {CATALOG.map((category) => (
            <article
              key={category.title}
              className="hover-corner-frame grid min-h-52 grid-cols-[5.5rem_1fr] gap-4 border-r border-b border-rule bg-paper p-5"
            >
              <span className="grid h-20 w-20 place-items-center border border-rule bg-media">
                <PartArt name={category.art} className="h-16 w-16" />
              </span>
              <div>
                <h3 className="text-base font-bold">
                  <Link
                    href={`/search?q=${encodeURIComponent(category.code)}`}
                    className="transition-colors hover:text-accent"
                  >
                    {category.title}
                  </Link>
                </h3>
                <ul className="mt-3 space-y-1 text-xs leading-relaxed text-muted">
                  {category.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Link
                  href={`/search?q=${encodeURIComponent(category.code)}`}
                  className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-accent"
                >
                  Смотреть <span aria-hidden>→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="popular" className="border-y border-rule-strong bg-surface">
        <div className="mx-auto grid max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
          <aside className="border border-rule-strong bg-paper p-5 lg:border-r-0">
            <p className="text-xs font-bold tracking-[0.1em] text-accent uppercase">
              Получение заказа
            </p>
            <h2 className="mt-3 text-xl font-black leading-tight">
              Самовывоз или доставка
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted">
              Самовывоз: Ленинградское шоссе, 13А
              <br />
              Ежедневно 10:00–21:00
            </p>
            <ul className="mt-4 space-y-2 border-t border-rule pt-4 text-xs text-muted">
              <li>— курьером по Ленинградской области</li>
              <li>— экспресс-доставка через Яндекс Go</li>
            </ul>
            <a
              href="tel:+79110141751"
              className="num mt-5 block border-t border-rule pt-4 text-sm font-bold transition-colors hover:text-accent"
            >
              +7 (911) 014-17-51
            </a>
            <a
              href="https://avtoservis-toksovo.ru/"
              target="_blank"
              rel="noreferrer"
              className="mt-6 block bg-graphite p-4 text-xs leading-relaxed text-graphite-ink transition-colors hover:bg-accent"
            >
              Нужна установка?
              <span className="mt-1 block font-bold">Записаться в автосервис →</span>
            </a>
          </aside>

          <div className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3 border border-rule-strong bg-paper px-5 py-4">
              <div>
                <p className="text-xs font-bold tracking-[0.1em] text-accent uppercase">
                  Часто ищут
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">Популярные товары</h2>
              </div>
              <p className="text-xs text-muted">Актуальные предложения откроются после поиска</p>
            </div>
            <ul className="grid border-l border-rule sm:grid-cols-2 lg:grid-cols-3">
              {POPULAR.map((item) => (
                <li key={item.code}>
                  <Link
                    href={`/search?q=${encodeURIComponent(item.code)}`}
                    className="hover-corner-frame group block h-full border-r border-b border-rule bg-paper p-4"
                  >
                    <span className="grid h-36 place-items-center border border-rule bg-media">
                      <PartArt name={item.name} className="h-28 w-28" />
                    </span>
                    <span className="mt-4 block text-[0.625rem] font-bold tracking-[0.1em] text-accent uppercase">
                      {item.brand}
                    </span>
                    <span className="mt-1 block min-h-10 text-sm font-bold leading-5">
                      {item.name}
                    </span>
                    <span className="mt-3 flex items-center justify-between border-t border-rule pt-3">
                      <span className="num text-[0.625rem] text-faint">{item.code}</span>
                      <span className="text-xs font-bold text-muted transition-colors group-hover:text-accent">
                        Найти →
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="how-to-order" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <SectionHeading
          eyebrow="Три шага"
          title="Как сделать заказ"
          description="От поиска нужного артикула до получения удобным способом."
        />
        <ol className="mt-7 grid border-t border-l border-rule md:grid-cols-3">
          <Step number="1" title="Найдите деталь">
            Введите артикул, OEM-номер или определите автомобиль по VIN.
          </Step>
          <Step number="2" title="Сравните предложения">
            Выберите цену, склад и подходящий срок доставки.
          </Step>
          <Step number="3" title="Получите заказ">
            Выберите самовывоз, курьера или экспресс-доставку через Яндекс Go.
          </Step>
        </ol>
      </section>
    </div>
  );
}

function CatalogSidebar() {
  return (
    <aside className="hidden border-r border-rule-strong bg-paper lg:block">
      <div className="bg-graphite px-5 py-5 text-sm font-bold text-graphite-ink">
        Каталог запчастей
      </div>
      <nav aria-label="Разделы каталога">
        {CATALOG.map((category) => (
          <Link
            key={category.title}
            href={`/search?q=${encodeURIComponent(category.code)}`}
            className="group flex min-h-12 items-center justify-between border-b border-rule px-5 text-xs font-semibold transition-colors hover:bg-surface hover:text-accent"
          >
            {category.title}
            <span className="text-faint transition-transform group-hover:translate-x-1" aria-hidden>
              →
            </span>
          </Link>
        ))}
      </nav>
      <a
        href="tel:+79110141751"
        className="block bg-accent p-5 text-accent-ink transition-colors hover:bg-graphite"
      >
        <span className="block text-[0.625rem] font-bold tracking-[0.1em] uppercase">
          Помощь с подбором
        </span>
        <span className="num mt-2 block text-xs font-bold">+7 (911) 014-17-51</span>
      </a>
    </aside>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-bold tracking-[0.1em] text-accent uppercase">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight">{title}</h2>
      </div>
      <p className="max-w-md text-sm leading-relaxed text-muted">{description}</p>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="border-r border-b border-rule p-6">
      <span className="num text-xs text-accent">0{number}</span>
      <h3 className="mt-4 text-xl font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
    </li>
  );
}
