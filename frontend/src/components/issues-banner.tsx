import type { SupplierIssue } from "@/lib/types";

/** Часть поставщиков не ответила. Молчать об этом нельзя: выдача неполная. */
export function IssuesBanner({ issues }: { issues: SupplierIssue[] }) {
  if (!issues.length) return null;

  return (
    <div className="flex gap-4 border border-warning/60 bg-warning-soft/60 px-4 py-4">
      <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center border border-warning text-xs font-bold text-warning">!</span>
      <div className="text-sm">
        <p className="font-semibold">Не все поставщики ответили</p>
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
