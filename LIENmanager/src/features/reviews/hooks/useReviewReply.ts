"use client";

import { useCallback, useState } from "react";

import type { ReviewDTO } from "@/types/review";

export interface UseReviewReplyResult {
  isGenerating: boolean;
  isSaving: boolean;
  isPosting: boolean;
  error: string | null;
  generate: (id: string) => Promise<ReviewDTO | null>;
  saveDraft: (id: string, replyText: string) => Promise<ReviewDTO | null>;
  post: (id: string) => Promise<ReviewDTO | null>;
}

async function parseReviewResponse(res: Response): Promise<ReviewDTO> {
  const data: { review?: ReviewDTO; error?: string } = await res.json();
  if (!res.ok || !data.review) {
    throw new Error(data.error ?? "リクエストに失敗しました");
  }
  return data.review;
}

// AI生成・下書き保存の呼び出しをまとめるフック。review-reply-panel.tsxから使う。
export function useReviewReply(): UseReviewReplyResult {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (id: string) => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/${id}/reply/generate`, { method: "POST" });
      return await parseReviewResponse(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "返信文の生成に失敗しました");
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const saveDraft = useCallback(async (id: string, replyText: string) => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyText }),
      });
      return await parseReviewResponse(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "下書きの保存に失敗しました");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const post = useCallback(async (id: string) => {
    setIsPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/${id}/reply/post`, { method: "POST" });
      return await parseReviewResponse(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "返信の投稿に失敗しました");
      return null;
    } finally {
      setIsPosting(false);
    }
  }, []);

  return { isGenerating, isSaving, isPosting, error, generate, saveDraft, post };
}
