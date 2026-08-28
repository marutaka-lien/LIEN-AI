// 「レビュー返信文自動生成・投稿」自動化モジュールの定義。rms-clickpost/rms-review-sync
// と同じ方針で、AutomationJob.moduleKeyの値をここに一元管理する。
//
// rms-clickpostと異なり、AutomationJobItem/AutomationStepは使わない。
// AutomationJobItemはOrder前提のスキーマ(orderId必須)であり無理に流用しないため、
// 処理対象1件=1レビューの状態はReview.replyStatus/replyErrorを一次ソースとする
// (レビュー一覧がそのまま処理結果の一元管理画面になる)。

export const RMS_REVIEW_REPLY_MODULE_KEY = "rms_review_reply";
