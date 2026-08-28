import { PageHeader } from "@/components/layout/page-header";
import { ShippingEntryWorkspace } from "@/components/automation/shipping-entry-workspace";
import { AUTOMATION_MODULES } from "@/lib/automation-modules";

export default function AutomationPage() {
  return (
    <>
      <PageHeader description="楽天RMSの発送待ち注文を対象にCSVを作成します。CSVはGoQSystemへ読み込ませ、一括申込・一括決済・一括印刷を行ってください。下の注文者一覧から対象を選んで個別にCSVを作成することもできます。" />

      <div className="flex flex-col gap-6 px-8 py-6">
        <ShippingEntryWorkspace modules={AUTOMATION_MODULES} />
      </div>
    </>
  );
}
