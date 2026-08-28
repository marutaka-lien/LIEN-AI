"use client";

import { Fragment, useState } from "react";
import { MessageSquareOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useReviewList, type UseReviewListFilters } from "@/features/reviews/hooks/useReviewList";
import { cn } from "@/lib/utils";
import type { ReviewDTO } from "@/types/review";
import { ReplyStatusBadge, ReviewReplyPanel } from "./review-reply-panel";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP");
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span
      className="font-mono text-xs tabular-nums text-warning-foreground"
      aria-label={`評価${rating}`}
    >
      {"★".repeat(rating)}
      <span className="text-muted-foreground">{"★".repeat(Math.max(0, 5 - rating))}</span>
    </span>
  );
}

export interface ReviewListTableProps {
  filters?: UseReviewListFilters;
  // レビュー同期完了直後の即時再取得トリガー(useReviewListのrefreshKeyへそのまま渡す)。
  refreshKey?: string | number;
}

export function ReviewListTable({ filters, refreshKey }: ReviewListTableProps = {}) {
  const { data: fetchedReviews, error } = useReviewList(filters, refreshKey);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 生成・保存直後は一覧の再取得を待たず、その場でバッジ表示等を更新するためのオーバーレイ。
  const [updatedReviews, setUpdatedReviews] = useState<Record<string, ReviewDTO>>({});

  const reviews = fetchedReviews?.map((review) => updatedReviews[review.id] ?? review) ?? null;

  if (reviews === null) {
    return (
      <p className="text-sm text-muted-foreground">
        {error ? "レビュー一覧の取得に失敗しました。" : "読み込み中..."}
      </p>
    );
  }

  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareOff}
        title="まだレビューがありません"
        description="「同期する」ボタンを押すと、楽天RMSから最新のレビューを取得します。"
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>種別</TableHead>
          <TableHead>評価</TableHead>
          <TableHead>商品名 / 注文番号</TableHead>
          <TableHead>タイトル</TableHead>
          <TableHead>本文</TableHead>
          <TableHead>投稿日時</TableHead>
          <TableHead>返信</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reviews.map((review) => (
          <Fragment key={review.id}>
            <TableRow
              className="cursor-pointer hover:bg-surface-hover"
              onClick={() => setExpandedId((current) => (current === review.id ? null : review.id))}
            >
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn(
                    "border-transparent",
                    review.reviewType === "shop"
                      ? "bg-primary-subtle text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {review.reviewType === "shop" ? "ショップ" : "商品"}
                </Badge>
              </TableCell>
              <TableCell>
                <StarRating rating={review.rating} />
              </TableCell>
              <TableCell className="max-w-[220px] text-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="truncate">{review.productName ?? "—"}</span>
                  {review.orderNumber && (
                    <span className="font-mono text-muted-foreground">{review.orderNumber}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="max-w-[160px] truncate text-xs">
                {review.title ?? "—"}
              </TableCell>
              <TableCell className="max-w-[360px] text-xs">
                <p className="line-clamp-2 text-muted-foreground">{review.body}</p>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {formatDate(review.reviewedAt)}
              </TableCell>
              <TableCell>
                <ReplyStatusBadge status={review.replyStatus} />
              </TableCell>
            </TableRow>
            {expandedId === review.id && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="bg-background p-3">
                  <ReviewReplyPanel
                    review={review}
                    onUpdated={(updated) =>
                      setUpdatedReviews((prev) => ({ ...prev, [updated.id]: updated }))
                    }
                    onClose={() => setExpandedId(null)}
                  />
                </TableCell>
              </TableRow>
            )}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
