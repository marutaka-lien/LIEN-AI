import { PageHeader } from "@/components/layout/page-header";
import { AutomationTabs } from "@/components/automation/automation-tabs";

export default function AutomationPage() {
  return (
    <>
      <PageHeader description="注文を各ステータスで処理してください。CSVはGoQSystemへ読み込ませ、一括申込・一括決済・一括印刷を行ってください。" />

      <div className="flex flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <AutomationTabs />
      </div>
    </>
  );
}
