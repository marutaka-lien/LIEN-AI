// AutomationJob/AutomationJobItem/AutomationStep の Union型。
// prisma/schema.prisma のコメント方針(SQLiteはenum未対応)に合わせ、
// DB上はStringで保持しアプリ層はここで型を絞る。将来PostgreSQL移行時にenum化する。

export type JobStatus = "pending" | "running" | "success" | "failed" | "stopped";

export type JobItemStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "skipped";

export type AutomationModuleKey = "rakuten_clickpost" | "rms_review_sync" | "rms_review_reply";

export interface OrderSummary {
  id: string;
  orderNumber: string;
  ordererName: string;
  recipientName: string | null;
  prefecture: string | null;
  address1: string | null;
}

export interface AutomationModuleMeta {
  key: AutomationModuleKey;
  title: string;
  description: string;
}

// --- ここから下は DB(Prisma)を裏付けとする画面表示専用DTO ---
// Prismaのモデルを直接UIへ渡さないための変換先。
// AutomationJob/AutomationJobItem/AutomationStep は特定モジュール専用ではなく、
// 将来追加される他の自動化モジュールとも共通利用できる形にしている。

export type StepStatus = "pending" | "running" | "success" | "failed" | "skipped";

export interface AutomationStepDTO {
  id: string;
  stepKey: string;
  status: StepStatus;
  retryCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface AutomationJobSummaryDTO {
  id: string;
  moduleKey: string;
  status: JobStatus;
  totalCount: number;
  successCount: number;
  failureCount: number;
  progressPercentage: number;
  currentLabel: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface AutomationJobItemDetailDTO {
  id: string;
  carrier: string;
  status: JobItemStatus;
  trackingNumber: string | null;
  errorMessage: string | null;
  order: OrderSummary;
  steps: AutomationStepDTO[];
}

export interface AutomationJobDetailDTO extends AutomationJobSummaryDTO {
  jobSteps: AutomationStepDTO[];
  items: AutomationJobItemDetailDTO[];
}

export interface DashboardSummaryDTO {
  processedCount: number;
  successCount: number;
  failureCount: number;
  runningJobCount: number;
  latestJob: AutomationJobSummaryDTO | null;
}
