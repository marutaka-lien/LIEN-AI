import {
  Circle,
  CircleCheck,
  CircleSlash,
  CircleX,
  LoaderCircle,
  PauseCircle,
  type LucideIcon,
} from "lucide-react";

import type { JobItemStatus, JobStatus, StepStatus } from "@/types/automation";

// Shipping Operations Console デザインシステム(Gate3で承認)のステータス表現。
// 色だけに依存せず、Icon・Label・className(色)の組み合わせで状態を伝える。

export interface StatusPresentation {
  label: string;
  className: string;
  icon: LucideIcon;
}

export const JOB_STATUS_BADGE: Record<JobStatus, StatusPresentation> = {
  pending: { label: "待機中", className: "bg-muted text-muted-foreground", icon: Circle },
  running: {
    label: "実行中",
    className: "bg-primary-subtle text-primary animate-pulse",
    icon: LoaderCircle,
  },
  success: { label: "完了", className: "bg-success-subtle text-success-foreground", icon: CircleCheck },
  failed: { label: "失敗あり", className: "bg-error-subtle text-error-foreground", icon: CircleX },
  stopped: {
    label: "停止中",
    className: "bg-warning-subtle text-warning-foreground",
    icon: PauseCircle,
  },
};

export const JOB_ITEM_STATUS_BADGE: Record<JobItemStatus, StatusPresentation> = {
  pending: { label: "待機中", className: "bg-muted text-muted-foreground", icon: Circle },
  running: {
    label: "処理中",
    className: "bg-primary-subtle text-primary animate-pulse",
    icon: LoaderCircle,
  },
  success: { label: "成功", className: "bg-success-subtle text-success-foreground", icon: CircleCheck },
  failed: { label: "失敗", className: "bg-error-subtle text-error-foreground", icon: CircleX },
  skipped: {
    label: "スキップ",
    className: "bg-muted text-status-skipped",
    icon: CircleSlash,
  },
};

export const STEP_STATUS_BADGE: Record<StepStatus, StatusPresentation> = {
  pending: { label: "待機中", className: "bg-muted text-muted-foreground", icon: Circle },
  running: {
    label: "実行中",
    className: "bg-primary-subtle text-primary animate-pulse",
    icon: LoaderCircle,
  },
  success: { label: "成功", className: "bg-success-subtle text-success-foreground", icon: CircleCheck },
  failed: { label: "失敗", className: "bg-error-subtle text-error-foreground", icon: CircleX },
  skipped: {
    label: "スキップ",
    className: "bg-muted text-status-skipped",
    icon: CircleSlash,
  },
};
