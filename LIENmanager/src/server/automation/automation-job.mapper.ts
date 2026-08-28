import type { AutomationJob, AutomationStep } from "@/generated/prisma/client";
import type {
  AutomationJobDetailDTO,
  AutomationJobItemDetailDTO,
  AutomationJobSummaryDTO,
  AutomationStepDTO,
  JobItemStatus,
  JobStatus,
  StepStatus,
} from "@/types/automation";
import type { AutomationJobWithDetails } from "./automation-job.repository";

function toIso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function toStepDTO(step: AutomationStep): AutomationStepDTO {
  return {
    id: step.id,
    stepKey: step.stepKey,
    status: step.status as StepStatus,
    retryCount: step.retryCount,
    errorMessage: step.errorMessage,
    startedAt: toIso(step.startedAt),
    finishedAt: toIso(step.finishedAt),
  };
}

export function toJobSummaryDTO(job: AutomationJob): AutomationJobSummaryDTO {
  return {
    id: job.id,
    moduleKey: job.moduleKey,
    status: job.status as JobStatus,
    totalCount: job.totalCount,
    successCount: job.successCount,
    failureCount: job.failureCount,
    progressPercentage: job.progressPercentage,
    currentLabel: job.currentLabel,
    startedAt: toIso(job.startedAt),
    finishedAt: toIso(job.finishedAt),
    createdAt: job.createdAt.toISOString(),
  };
}

export function toJobDetailDTO(job: AutomationJobWithDetails): AutomationJobDetailDTO {
  const items: AutomationJobItemDetailDTO[] = job.items.map((item) => ({
    id: item.id,
    carrier: item.carrier,
    status: item.status as JobItemStatus,
    trackingNumber: item.trackingNumber,
    errorMessage: item.errorMessage,
    order: {
      id: item.order.id,
      orderNumber: item.order.orderNumber,
      ordererName: item.order.ordererName,
      recipientName: item.order.recipientName,
      prefecture: item.order.prefecture,
      address1: item.order.address1,
    },
    steps: item.steps.map(toStepDTO),
  }));

  return {
    ...toJobSummaryDTO(job),
    jobSteps: job.steps.map(toStepDTO),
    items,
  };
}
