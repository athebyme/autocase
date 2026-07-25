import type { Metadata } from "next";
import { Suspense } from "react";

import { IssuesBanner } from "@/components/issues-banner";
import { ProductCard } from "@/components/product-card";
import { SearchField } from "@/components/search-field";
import { Empty } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { plural } from "@/lib/format";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `${q} — цены и наличие` : "Поиск запчастей" };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <SearchField key={query} initial={query} size="inline" />
      </div>

      <div className="mt-10">
        {query ? (
          <Suspense key={query} fallback={<Loading />}>
            <Results query={query} />
          </Suspense>
        ) : (
          <Empty title="Введите номер детали" hint="Например PH5883 или W712/75" />
        )}
      </div>
    </div>
  );
}

async function Results({ query }: { query: string }) {
  let result;
  try {
    result = await api.offersByCode(query);
  } catch (error) {
    return (
      <Empty
        title="Не удалось загрузить цены"
        hint={error instanceof ApiError ? error.message : "Попробуйте обновить страницу"}
      />
    );
  }

  const exact = result.groups.filter((group) => !group.is_analog);
  const similar = result.groups.filter((group) => group.is_analog);

  if (!exact.length && !similar.length) {
    return (
      <Empty
        title="Ничего не нашли"
        hint={
          <>
            По номеру <span className="num text-ink">{query}</span> предложений нет. Проверьте
            написание — лишние пробелы и дефисы мы убираем сами.
          </>
        }
      />
    );
  }

  const found = exact.length || similar.length;

  return (
    <div className="space-y-10">
      {result.issues.length ? <IssuesBanner issues={result.issues} /> : null}

      <section>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {exact.length ? "Нашли по вашему номеру" : "Точных совпадений нет"}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {exact.length
            ? `${found} ${plural(found, "товар", "товара", "товаров")} · цены и сроки уже с учётом наличия`
            : "Показываем детали, которые подходят вместо неё"}
        </p>

        <div className="mt-6 space-y-4">
          {exact.map((group) => (
            <ProductCard key={group.part_id} group={group} />
          ))}
        </div>
      </section>

      {similar.length ? (
        <section>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Подходящие замены</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-muted">
            Те же характеристики, другие производители. Часто дешевле — но перед заказом сверьте
            деталь с той, что стоит у вас.
          </p>

          <div className="mt-6 space-y-4">
            {similar.map((group) => (
              <ProductCard key={group.part_id} group={group} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex animate-pulse gap-6 border border-rule p-6">
          <div className="h-24 w-24 shrink-0 bg-rule/60 sm:h-28 sm:w-28" />
          <div className="flex-1 space-y-3 py-2">
            <div className="h-3 w-24 bg-rule/60" />
            <div className="h-5 w-2/3 bg-rule/60" />
            <div className="h-3 w-32 bg-rule/60" />
          </div>
          <div className="hidden w-32 space-y-3 py-2 sm:block">
            <div className="ml-auto h-6 w-24 bg-rule/60" />
            <div className="ml-auto h-10 w-32 bg-rule/60" />
          </div>
        </div>
      ))}
    </div>
  );
}
