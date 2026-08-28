import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/server/db/prisma";

const RUNNING_STATUSES = ["pending", "running"];

const jobDetailInclude = {
  steps: { orderBy: { createdAt: "asc" } },
  items: {
    include: {
      order: true,
      steps: { orderBy: { createdAt: "asc" } },
    },
  },
} as const;

// テスト用にPrismaClientを注入可能にする(order.repository.tsと同じパターン)。
export function createAutomationJobRepository(prismaClient: PrismaClient = defaultPrisma) {
  return {
    findRecent(limit: number) {
      return prismaClient.automationJob.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    },

    findByIdWithDetails(id: string) {
      return prismaClient.automationJob.findUnique({
        where: { id },
        include: jobDetailInclude,
      });
    },

    countRunning() {
      return prismaClient.automationJob.count({
        where: { status: { in: RUNNING_STATUSES } },
      });
    },

    // --- Orchestrator用の書き込みメソッド ---

    createJob(data: Prisma.AutomationJobUncheckedCreateInput) {
      return prismaClient.automationJob.create({ data });
    },

    updateJob(id: string, data: Prisma.AutomationJobUncheckedUpdateInput) {
      return prismaClient.automationJob.update({ where: { id }, data });
    },

    // stopRequestedの確認のみを行う軽量チェック(Job全体を毎回取得しない)。
    isStopRequested(id: string) {
      return prismaClient.automationJob
        .findUnique({ where: { id }, select: { stopRequested: true } })
        .then((job) => job?.stopRequested ?? false);
    },

    createItem(data: Prisma.AutomationJobItemUncheckedCreateInput) {
      return prismaClient.automationJobItem.create({ data });
    },

    updateItem(id: string, data: Prisma.AutomationJobItemUncheckedUpdateInput) {
      return prismaClient.automationJobItem.update({ where: { id }, data });
    },

    createStep(data: Prisma.AutomationStepUncheckedCreateInput) {
      return prismaClient.automationStep.create({ data });
    },

    updateStep(id: string, data: Prisma.AutomationStepUncheckedUpdateInput) {
      return prismaClient.automationStep.update({ where: { id }, data });
    },
  };
}

export const automationJobRepository = createAutomationJobRepository();

export type AutomationJobWithDetails = NonNullable<
  Awaited<ReturnType<typeof automationJobRepository.findByIdWithDetails>>
>;
