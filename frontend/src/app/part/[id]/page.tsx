import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { IssuesBanner } from "@/components/issues-banner";
import { OfferFilters } from "@/components/offer-filters";
import { OfferGroups } from "@/components/offer-groups";
import { CornerFrame, Empty, Price, SectionLabel } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { formatDelivery, plural } from "@/lib/format";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ analogs?: string; transit?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const result = await api.offersForPart(decodeURIComponent(id));
    if (!result.part) return { title: "Карточка товара" };
    return {
      title: `${result.part.code} ${result.part.brand} — наличие и цены`,
      description: `${result.part.name}. ${result.offers.length} предложений по складам.`,
    };
  } catch {
    return { title: "Карточка товара" };
  }
}

export default async function PartPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const partId = decodeURIComponent(id);
  const filters = { analogs: query.analogs !== "0", transit: query.transit !== "0" };

  let result;
  try {
    result = await api.offersForPart(partId, filters);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    return (
      <div className="mx-auto max-w-[104rem] px-4 py-12 sm:px-6">
        <Empty
          title="Не удалось открыть карточку"
          hint={error instanceof ApiError ? error.message : "Непредвиденная ошибка"}
          action={
            <Link
              href="/"
              className="border border-ink px-4 py-2 text-[0.6875rem] font-semibold tracking-[0.14em] uppercase transition-colors hover:bg-ink hover:text-paper"
            >
              К поиску
            </Link>
          }
        />
      </div>
    );
  }

  const part = result.part;
  const own = result.offers.filter((offer) => !offer.is_analog);
  const cheapest = own.length ? Math.min(...own.map((offer) => offer.price)) : null;
  const fastest = own
    .map((offer) => offer.delivery_days)
    .filter((days): days is number => days !== null);
  const comment = own.find((offer) => offer.part_comment)?.part_comment ?? null;

  return (
    <div className="mx-auto max-w-[104rem] px-4 py-10 sm:px-6 sm:py-12">
      <nav className="num flex items-center gap-2 text-[0.625rem] tracking-[0.14em] text-faint uppercase">
        <Link href="/" className="transition-colors hover:text-ink">
          Подбор
        </Link>
        <span aria-hidden>/</span>
        {part ? (
          <Link
            href={`/search?q=${encodeURIComponent(part.code)}`}
            className="transition-colors hover:text-ink"
          >
            {part.code}
          </Link>
        ) : (
          <span>карточка</span>
        )}
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold tracking-[0.2em] text-accent uppercase">
            {part?.brand ?? "—"}
          </p>
          <h1 className="num mt-2 text-[clamp(2.25rem,6vw,4.5rem)] leading-[0.9] font-medium tracking-[-0.03em] break-all">
            {part?.code ?? "Карточка"}
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">{part?.name}</p>

          {comment ? (
            <p className="mt-5 max-w-2xl border-l-2 border-rule-strong pl-4 text-sm leading-relaxed text-muted">
              {comment}
            </p>
          ) : null}
        </div>

        <CornerFrame className="h-fit bg-surface/70">
          <dl className="divide-y divide-rule text-sm">
            <Row term="Лучшая цена">
              {cheapest !== null ? (
                <Price value={cheapest} currency={own[0]?.currency} size="sm" tone="accent" />
              ) : (
                "—"
              )}
            </Row>
            <Row term="Ближайший срок">
              {fastest.length ? formatDelivery(Math.min(...fastest)) : "—"}
            </Row>
            <Row term="Складов">
              {own.length} {plural(own.length, "склад", "склада", "складов")}
            </Row>
            <Row term="Аналогов">{result.analog_count}</Row>
            <Row term="Поставщик">{part?.supplier_name ?? "—"}</Row>
          </dl>
        </CornerFrame>
      </div>

      <div className="mt-12 space-y-8">
        {result.issues.length ? <IssuesBanner issues={result.issues} /> : null}

        <SectionLabel index="01" aside={<OfferFilters />}>
          Наличие и цены
        </SectionLabel>

        {result.groups.length ? (
          <OfferGroups
            groups={result.groups}
            bestOfferId={result.best_offer_id}
            linkToPart={false}
          />
        ) : (
          <Empty
            title="Предложений нет"
            hint="Сейчас эта позиция недоступна ни на одном складе. Попробуйте позже или посмотрите аналоги."
          />
        )}
      </div>
    </div>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <dt className="text-[0.6875rem] tracking-[0.1em] text-faint uppercase">{term}</dt>
      <dd className="num text-xs text-ink">{children}</dd>
    </div>
  );
}
