"use client";

import { useState } from "react";
import { RefreshCw, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useReviewReply } from "@/features/reviews/hooks/useReviewReply";
import { cn } from "@/lib/utils";
import type { ReviewDTO, ReviewReplyStatus } from "@/types/review";

// レビュー一覧の行を展開した際に表示する詳細パネル。
// AI生成・下書き編集・保存・RMSへの投稿を行う。

const REPLY_STATUS_LABEL: Record<ReviewReplyStatus, string> = {
  unreplied: "未返信",
  draft: "下書き",
  posted: "投稿済み",
  failed: "失敗",
};

const REPLY_STATUS_CLASSNAME: Record<ReviewReplyStatus, string> = {
  unreplied: "bg-muted text-muted-foreground",
  draft: "bg-warning-subtle text-warning-foreground",
  posted: "bg-success-subtle text-success-foreground",
  failed: "bg-destructive/10 text-destructive",
};

export function ReplyStatusBadge({ status }: { status: ReviewReplyStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", REPLY_STATUS_CLASSNAME[status])}>
      {REPLY_STATUS_LABEL[status]}
    </Badge>
  );
}

export interface ReviewReplyPanelProps {
  review: ReviewDTO;
  // 生成・保存が成功した際に、一覧側の状態(バッジ表示など)を更新するためのコールバック。
  onUpdated: (updated: ReviewDTO) => void;
  // パネルを閉じる(行の展開状態を折りたたむ)ためのコールバック。
  onClose: () => void;
}

export function ReviewReplyPanel({ review, onUpdated, onClose }: ReviewReplyPanelProps) {
  // 行の展開/折りたたみで本コンポーネントは都度マウントし直されるため(親のreview-list-table.tsx
  // 参照)、reviewが切り替わった際のテキストエリア初期化はuseState初期値だけで足りる
  // (useEffectでのsetStateは不要)。
  const { isGenerating, isSaving, isPosting, error, generate, saveDraft, post } = useReviewReply();
  const [draftText, setDraftText] = useState(review.replyText ?? "");

  async function handleGenerate() {
    const updated = await generate(review.id);
    if (updated) {
      setDraftText(updated.replyText ?? "");
      onUpdated(updated);
    }
  }

  async function handleSaveDraft() {
    if (!draftText.trim()) return;
    const updated = await saveDraft(review.id, draftText);
    if (updated) onUpdated(updated);
  }

  async function handlePost() {
    if (!review.replyText?.trim()) return;
    const confirmed = window.confirm(
      `この内容で楽天RMSへ返信を投稿します。よろしいですか?\n\n${review.replyText}`
    );
    if (!confirmed) return;

    const updated = await post(review.id);
    if (updated) onUpdated(updated);
  }

  const isBusy = isGenerating || isSaving || isPosting;
  const hasUnsavedEdits = draftText !== (review.replyText ?? "");

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">レビュー詳細</p>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onClose}
          aria-label="レビュー詳細を閉じる"
          title="閉じる"
        >
          <X />
        </Button>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">レビュー本文</p>
        <p className="whitespace-pre-wrap">{review.body}</p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">返信文</p>
          <Button size="xs" variant="outline" onClick={handleGenerate} disabled={isBusy}>
            <RefreshCw className={cn(isGenerating && "animate-spin")} />
            {review.replyText ? "再生成" : "AIで生成"}
          </Button>
        </div>
        <textarea
          className="min-h-24 rounded-lg border border-border bg-background p-2 text-sm text-foreground"
          value={draftText}
          onChange={(event) => setDraftText(event.target.value)}
          placeholder="AIで生成するか、直接入力してください"
          disabled={isBusy}
        />
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleSaveDraft}
            disabled={isBusy || !draftText.trim() || !hasUnsavedEdits}
          >
            下書き保存
          </Button>
          <Button
            size="sm"
            onClick={handlePost}
            disabled={
              isBusy ||
              hasUnsavedEdits ||
              !review.replyText?.trim() ||
              review.replyStatus === "posted"
            }
          >
            {review.replyStatus === "posted" ? "投稿済み" : "RMSへ投稿する"}
          </Button>
        </div>
        {hasUnsavedEdits && (
          <p className="text-xs text-muted-foreground">
            投稿する前に、編集内容を「下書き保存」してください。
          </p>
        )}
        {review.replyStatus !== "posted" && (
          <p className="text-xs text-muted-foreground">
            RMSへの自動投稿はサーバー側の設定(RMS_REVIEW_REPLY_EXECUTE)で有効化するまでは行われません。
          </p>
        )}
      </div>

      {(error || review.replyError) && (
        <p className="text-xs text-destructive">エラー: {error ?? review.replyError}</p>
      )}
    </div>
  );
}
