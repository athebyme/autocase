import type { SupplierIssue } from "@/lib/types";

/** Часть поставщиков не ответила. Молчать об этом нельзя: выдача неполная. */
export function IssuesBanner({ issues }: { issues: SupplierIssue[] }) {
  if (!issues.length) return null;

  return (
    <div className="flex gap-3 border border-warning/45 bg-warning-soft/60 px-4 py-3">
      <span aria-hidden className="mt-0.5 w-[3px] shrink-0 self-stretch bg-warning" />
      <div className="text-sm">
        <p className="font-semibold">Выдача неполная</p>
        <ul className="mt-1 space-y-0.5 text-muted">
          {issues.map((issue) => (
            <li key={`${issue.supplier}:${issue.kind}`}>
              <span className="num text-[0.6875rem] tracking-[0.1em] uppercase">
                {issue.supplier_name}
              </span>{" "}
              — {issue.message}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
