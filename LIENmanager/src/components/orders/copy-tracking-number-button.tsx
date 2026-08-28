"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

// RMSへの追跡番号自動反映(updateOrderShipping)がまだ未確立のため、
// 当面は「取得した追跡番号をコピーしてRMS管理画面へ手動入力する」運用の補助ボタン。
export function CopyTrackingNumberButton({ trackingNumber }: { trackingNumber: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(trackingNumber);
      setCopied(true);
      toast("追跡番号をコピーしました");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("コピーに失敗しました");
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="ml-1"
      aria-label={`追跡番号 ${trackingNumber} をコピー`}
      onClick={handleCopy}
    >
      {copied ? <Check className="text-success-foreground" /> : <Copy />}
    </Button>
  );
}
