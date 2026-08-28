import type {
  PublicReplyCheckResult,
  PublicReplyJudgement,
} from "@/server/integrations/rms-review/rms-review-public-reply-checker";
import { createReviewRepository, reviewRepository as defaultReviewRepository } from "./review.repository";

// 棚卸しタスク(2026-08-26、CEO委任): Review.replyStatus="unreplied"のレコードのうち、
// 実際には(自社アプリを経由しない手動対応等で)既に返信済みのものを、楽天の公開
// レビューページ(review.rakuten.co.jp)の「ショップからのコメント」ブロックの有無で
// 洗い出す。判定ロジック自体はrms-review-public-reply-checker.tsに実装済み。
// このファイルは複数件の判定結果を集計してレポート化する層と、将来のDB反映用ロジックを持つ。
//
// 【重要】今回のタスクはdry-runのみ。applyReconciliationUpdatesはこのファイル内・
// 呼び出し側のいずれからも実行してはならない(実行するとDBのreplyStatusが書き換わる)。
// 実際にDBへ反映するかどうかは経営側が別タスクとして判断する。

export interface ReconciliationTargetReview {
  id: string;
  sourceUrl: string;
  reviewType: string;
}

export interface ReconciliationRow {
  id: string;
  sourceUrl: string;
  reviewType: string;
  judgement: PublicReplyJudgement;
  repliedAt: Date | null;
  repliedDateText: string | null;
  reason?: string;
}

export interface ReconciliationSummary {
  totalUnreplied: number;
  repliedCount: number; // 実際には返信済みと判定された件数
  notRepliedCount: number; // 公開ページ上も未返信と判定された件数
  undeterminedCount: number; // ページ遷移失敗等で判定できなかった件数
  rows: ReconciliationRow[];
}

// レビュー1件ずつ楽天の公開ページを確認し、判定結果を集計する(読み取りのみ)。
// checkOneはPlaywrightのPageを閉じ込めた関数を呼び出し側から注入する(このファイルは
// ブラウザのライフサイクルを一切管理しない。テスト時はモック関数を渡せる)。
// delayMsは楽天サーバーへの連続アクセスを避けるための任意のスリープ(既定なし)。
export async function buildReconciliationReport(
  reviews: ReconciliationTargetReview[],
  checkOne: (sourceUrl: string) => Promise<PublicReplyCheckResult>,
  options: { delayMs?: number } = {}
): Promise<ReconciliationSummary> {
  const rows: ReconciliationRow[] = [];

  for (const review of reviews) {
    const result = await checkOne(review.sourceUrl);
    rows.push({
      id: review.id,
      sourceUrl: review.sourceUrl,
      reviewType: review.reviewType,
      judgement: result.judgement,
      repliedAt: result.repliedAt,
      repliedDateText: result.repliedDateText,
      reason: result.reason,
    });

    if (options.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
  }

  return {
    totalUnreplied: rows.length,
    repliedCount: rows.filter((row) => row.judgement === "replied").length,
    notRepliedCount: rows.filter((row) => row.judgement === "not_replied").length,
    undeterminedCount: rows.filter((row) => row.judgement === "undetermined").length,
    rows,
  };
}

export interface ApplyReconciliationOptions {
  // 既定false(dry-run)。trueにしない限りDBへの書き込みは一切行われない。
  apply: boolean;
}

export interface ApplyReconciliationResult {
  dryRun: boolean;
  wouldUpdateCount: number;
  updatedCount: number;
}

// 【今回のタスクでは呼び出し禁止】judgement==="replied"の行について、
// replyStatusを"posted"に、repliedAtを検出した返信日(取れなければ実行時刻)に更新する。
// review.service.ts の postReply と同じ二重ガード方式を踏襲する:
//   1. options.apply が明示的に true であること
//   2. 環境変数 REVIEW_RECONCILIATION_APPLY_EXECUTE が "true" であること
// のどちらか一方でも欠けていれば書き込みを行わない(前者はdry-run扱いで正常終了、
// 後者は経営承認前の誤実行防止のためエラーを投げる)。
//
// 次回、実際にDB反映を行うタスクでは、このファイルをそのままimportし、
// applyReconciliationUpdates(rows, reviewRepository, { apply: true }) を
// 環境変数 REVIEW_RECONCILIATION_APPLY_EXECUTE=true を設定した上で呼び出せばよい。
export async function applyReconciliationUpdates(
  rows: ReconciliationRow[],
  repository: ReturnType<typeof createReviewRepository> = defaultReviewRepository,
  options: ApplyReconciliationOptions = { apply: false }
): Promise<ApplyReconciliationResult> {
  const targets = rows.filter((row) => row.judgement === "replied");

  if (!options.apply) {
    return { dryRun: true, wouldUpdateCount: targets.length, updatedCount: 0 };
  }

  if (process.env.REVIEW_RECONCILIATION_APPLY_EXECUTE !== "true") {
    throw new Error(
      "DB更新の実行はREVIEW_RECONCILIATION_APPLY_EXECUTE=trueが設定されるまで無効化されています" +
        "(経営承認後に設定してください)。"
    );
  }

  let updatedCount = 0;
  for (const row of targets) {
    await repository.updateReply(row.id, {
      replyStatus: "posted",
      repliedAt: row.repliedAt ?? new Date(),
    });
    updatedCount++;
  }

  return { dryRun: false, wouldUpdateCount: targets.length, updatedCount };
}
