import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 pb-2 pt-7 sm:px-6 lg:px-8 lg:pt-9">
      <div className="flex max-w-3xl flex-col gap-2">
        {title && <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{title}</h1>}
        {description && (
          <p className="text-sm leading-6 text-text-secondary">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
