// /dashboard の読み込み中スケルトン（C案の2ゾーン構成に合わせた枠だけ）。
// ブランクや無限スピナーは出さない方針。

function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-surface-elevated ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <>
      <div className="flex items-start justify-between gap-4 px-4 pb-2 pt-7 sm:px-6 lg:px-8 lg:pt-9">
        <Block className="h-9 w-64" />
        <Block className="h-5 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-8 px-4 py-5 sm:px-6 lg:grid-cols-[58fr_42fr] lg:px-8">
        <div className="flex flex-col gap-4 lg:border-r lg:border-border-subtle lg:pr-6">
          <Block className="h-5 w-40" />
          <Block className="h-16" />
          <div className="grid grid-cols-2 gap-3">
            <Block className="h-28" />
            <Block className="h-28" />
            <Block className="h-28" />
            <Block className="h-28" />
          </div>
          <Block className="h-32" />
          <Block className="mt-auto h-32" />
        </div>
        <div className="flex flex-col gap-4">
          <Block className="h-5 w-44" />
          <Block className="h-72" />
          <Block className="h-56" />
        </div>
      </div>
    </>
  );
}
