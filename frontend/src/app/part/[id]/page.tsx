import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { IssuesBanner } from "@/components/issues-banner";
import { PartDetail } from "@/components/part-detail";
import { Empty } from "@/components/ui";
import { ApiError, api } from "@/lib/api";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const result = await api.offersForPart(decodeURIComponent(id));
    if (!result.part) return { title: "Запчасть" };
    return {
      title: `${result.part.name} ${result.part.brand} ${result.part.code}`,
      description: `${result.part.name} ${result.part.brand}, артикул ${result.part.code}. Цена, наличие и срок доставки.`,
    };
  } catch {
    return { title: "Запчасть" };
  }
}

export default async function PartPage({ params }: PageProps) {
  const { id } = await params;
  const partId = decodeURIComponent(id);

  let result;
  try {
    result = await api.offersForPart(partId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <Empty
          title="Не удалось открыть товар"
          hint={error instanceof ApiError ? error.message : "Попробуйте обновить страницу"}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-accent"
      >
        <span aria-hidden>←</span> К поиску
      </Link>

      <div className="mt-8 space-y-8">
        {result.issues.length ? <IssuesBanner issues={result.issues} /> : null}
        <PartDetail result={result} />
      </div>
    </div>
  );
}
