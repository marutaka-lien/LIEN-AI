// /dashboard の読み込み中スケルトン（2ゾーン構成に合わせた枠だけ）。
// ブランクや無限スピナーは出さない方針。

function Block({ className = "" }: { className?: string }) {
  return <div className={`glass animate-pulse rounded-2xl ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="grid grid-cols-1 gap-5 px-4 pb-10 pt-2 sm:px-6 lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)] lg:px-8">
      <div className="flex flex-col gap-5">
        <Block className="h-40 rounded-[1.75rem]" />
        <Block className="h-14" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Block className="h-36" />
          <Block className="h-36" />
          <Block className="h-36" />
        </div>
        <Block className="h-36" />
      </div>
      <div className="flex flex-col gap-5">
        <Block className="h-80 rounded-[1.75rem]" />
        <Block className="h-56 rounded-[1.75rem]" />
      </div>
    </div>
  );
}
