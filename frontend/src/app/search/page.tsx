import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { IssuesBanner } from "@/components/issues-banner";
import { OfferFilters } from "@/components/offer-filters";
import { OfferGroups } from "@/components/offer-groups";
import { SearchField } from "@/components/search-field";
import { Empty, SectionLabel, SkeletonRow } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { plural } from "@/lib/format";

interface PageProps {
  searchParams: Promise<{ q?: string; analogs?: string; transit?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `${q} — наличие и цены` : "Поиск по артикулу" };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const filters = { analogs: params.analogs !== "0", transit: params.transit !== "0" };

  return (
    <div className="mx-auto max-w-[104rem] px-4 py-10 sm:px-6 sm:py-12">
      <SectionLabel index="01" aside={<OfferFilters />}>
        Проценка по артикулу
      </SectionLabel>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-end">
        {/* key сбрасывает содержимое поля при переходе к другому запросу. */}
        <SearchField key={query} initial={query} size="inline" />
        {query ? (
          <p className="text-[clamp(2rem,5vw,3.5rem)] leading-none font-black tracking-[-0.04em] break-all uppercase lg:text-right">
            {query}
          </p>
        ) : null}
      </div>

      <div className="mt-10">
        {query ? (
          <Suspense key={`${query}-${params.analogs}-${params.transit}`} fallback={<LoadingList />}>
            <Results query={query} filters={filters} />
          </Suspense>
        ) : (
          <Empty
            title="Введите артикул"
            hint="Например PH5883 или W712/75. Можно с дефисами и пробелами — приведём сами."
          />
        )}
      </div>
    </div>
  );
}

async function Results({
  query,
  filters,
}: {
  query: string;
  filters: { analogs: boolean; transit: boolean };
}) {
  let result;
  try {
    result = await api.offersByCode(query, filters);
  } catch (error) {
    return <Failure error={error} />;
  }

  if (!result.groups.length) {
    return (
      <Empty
        title="Ничего не нашлось"
        hint={
          <>
            По артикулу <span className="num text-ink">{query}</span> предложений нет. Проверьте
            написание или попробуйте номер аналога.
            {!filters.analogs || !filters.transit ? (
              <>
                {" "}
                Также сейчас включены фильтры — попробуйте{" "}
                <Link href={`/search?q=${encodeURIComponent(query)}`} className="text-accent underline underline-offset-4">
                  сбросить их
                </Link>
                .
              </>
            ) : null}
          </>
        }
      />
    );
  }

  const exactCount = result.offers.filter((offer) => !offer.is_analog).length;

  return (
    <div className="space-y-8">
      {result.issues.length ? <IssuesBanner issues={result.issues} /> : null}

      <dl className="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-4">
        <Stat term="Предложений" value={`${result.offers.length}`} />
        <Stat term="По артикулу" value={`${exactCount}`} />
        <Stat term="Аналогов" value={`${result.analog_count}`} />
        <Stat
          term="Карточек"
          value={`${result.groups.length} ${plural(result.groups.length, "шт", "шт", "шт")}`}
        />
      </dl>

      <OfferGroups groups={result.groups} bestOfferId={result.best_offer_id} />
    </div>
  );
}

function Stat({ term, value }: { term: string; value: string }) {
  return (
    <div className="bg-paper px-4 py-3">
      <dt className="num text-[0.625rem] tracking-[0.16em] text-faint uppercase">{term}</dt>
      <dd className="num mt-1 text-xl font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function Failure({ error }: { error: unknown }) {
  const message = error instanceof ApiError ? error.message : "Непредвиденная ошибка";
  const detail = error instanceof ApiError ? error.detail : null;

  return (
    <Empty
      title="Не удалось получить проценку"
      hint={
        <>
          {message}
          {detail ? <span className="mt-1 block text-xs text-faint">{detail}</span> : null}
        </>
      }
    />
  );
}

function LoadingList() {
  return (
    <div className="border border-rule">
      {Array.from({ length: 6 }).map((_, index) => (
        <SkeletonRow key={index} />
      ))}
    </div>
  );
}
