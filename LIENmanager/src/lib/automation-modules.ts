import type { AutomationModuleMeta } from "@/types/automation";

// 自動化モジュールのレジストリ。AutomationJob.moduleKey はこの一覧のkeyに対応する。
// 新しい自動化モジュールを追加する際はここに追記するだけでよい。
export const AUTOMATION_MODULES: AutomationModuleMeta[] = [
  {
    key: "rakuten_clickpost",
    title: "クリックポスト発送エントリー",
    description:
      "楽天RMSの発送待ち注文を取得し、クリックポストへのまとめ申込登録まで自動で行います。決済・ラベル印刷はGoQSystemで行ってください。",
  },
];

export function getModuleMeta(moduleKey: string): AutomationModuleMeta | undefined {
  return AUTOMATION_MODULES.find((module) => module.key === moduleKey);
}
