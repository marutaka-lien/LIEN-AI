// 「RMSレビュー同期」自動化モジュールの定義。rms-clickpost/automation-module.tsと
// 同じ方針で、AutomationJob.moduleKey / AutomationStep.stepKeyの値をここに一元管理する。

export const RMS_REVIEW_SYNC_MODULE_KEY = "rms_review_sync";

export const STEP_KEY = {
  // すべてJob全体に紐づくステップ(jobItemId=null)。レビュー同期は注文単位の
  // ループを持たないため、rms-clickpostのような注文単位ステップは存在しない。
  CSV_DOWNLOAD: "csv_download",
  CSV_PARSE: "csv_parse",
  UPSERT: "upsert",
  // 保持期間(既定6ヶ月)を過ぎたレビューをアーカイブファイルへ移動する。
  // 失敗してもレビュー取り込み自体は成功として扱う(付随処理のため)。
  ARCHIVE_PRUNE: "archive_prune",
} as const;
