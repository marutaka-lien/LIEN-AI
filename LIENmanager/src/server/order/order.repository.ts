import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/server/db/prisma";
import { getJstDayRange } from "@/lib/date";
import type { OrderUpsertInput } from "@/types/order";

// 発送エントリー画面向け: 「処理が完了していない」= 注文確認待ち(100)・発送待ち(300)のみ。
const PENDING_ORDER_STATUSES = ["100", "300"];

export interface OrderListFilters {
  // 今日(JST)の注文のみに絞る。
  todayOnly?: boolean;
  // 処理が完了していない注文(注文確認待ち・発送待ち)のみに絞る。
  pendingOnly?: boolean;
}

// channel + orderNumber を一意キーとして同期する。同じ注文を何度取得しても
// 重複登録されず、既存行は上書き更新される。
// PrismaClientを注入可能にしているのはテスト用(インメモリDBに差し替えるため)。
export function createOrderRepository(prismaClient: PrismaClient = defaultPrisma) {
  return {
    upsertByChannelAndOrderNumber(input: OrderUpsertInput) {
      return prismaClient.order.upsert({
        where: {
          channel_orderNumber: {
            channel: input.channel,
            orderNumber: input.orderNumber,
          },
        },
        create: input,
        update: input,
      });
    },

    // Orchestrator用: ClickPost連携はrawPayload等を含む生のOrderモデルを必要とするため、
    // UI表示用のOrderDTOとは別にPrismaモデルをそのまま返す(サーバー内部専用)。
    findById(id: string) {
      return prismaClient.order.findUnique({ where: { id } });
    },

    findByChannelAndOrderNumber(channel: string, orderNumber: string) {
      return prismaClient.order.findUnique({
        where: { channel_orderNumber: { channel, orderNumber } },
      });
    },

    // ClickPost追跡番号のRMS反映用。OrderUpsertInput(RMS同期専用)とは意図的に分離し、
    // trackingNumber/rmsShippingReflectedAt以外のフィールドへ影響を与えない。
    updateTrackingInfo(
      id: string,
      data: { trackingNumber: string; rmsShippingReflectedAt?: Date }
    ) {
      return prismaClient.order.update({ where: { id }, data });
    },

    // ClickPost「まとめ申込〜支払手続き画面到達」成功時にOrchestratorが呼ぶ。
    // これ以外のフィールドには影響を与えない(trackingNumber等とは意図的に分離)。
    markClickPostRegistered(id: string, registeredAt: Date) {
      return prismaClient.order.update({
        where: { id },
        data: { clickPostRegisteredAt: registeredAt },
      });
    },

    // Orchestrator用: 「状態ベース」のClickPost処理対象判定。受注日には一切依存しない
    // (2026-08-25経営判断: 日付フィルタで積み残しが発生するリスクを避けるため)。
    // 対象 = orderStatus=300(発送待ち、RMSで確認済み) かつ clickPostRegisteredAtが未設定。
    // 古い注文から先に処理されるよう orderedAt 昇順で返す(findShippingReadyOrdersと同じ方針)。
    findClickPostTargetOrders() {
      return prismaClient.order.findMany({
        where: { orderStatus: "300", clickPostRegisteredAt: null },
        orderBy: { orderedAt: "asc" },
      });
    },

    // 注文一覧画面用: 直近の注文を新しい順に取得する。
    findMany(limit: number, filters: OrderListFilters = {}) {
      const where: Prisma.OrderWhereInput = {};

      if (filters.todayOnly) {
        const { start, end } = getJstDayRange();
        where.orderedAt = { gte: start, lt: end };
      }

      if (filters.pendingOnly) {
        // RMSのorderStatusは発送完了しても自動では300→500に進まない(書き戻しAPI未実装)ため、
        // orderStatusだけでは「自社アプリ側で処理済みか」を判定できない。CSV出力・ClickPost登録が
        // 済んでいる注文は一次ソースであるcsvExportedAt/clickPostRegisteredAtで除外する
        // (2026-08-26: 処理済み注文が一覧に残り続けるバグの修正)。
        where.orderStatus = { in: PENDING_ORDER_STATUSES };
        where.csvExportedAt = null;
        where.clickPostRegisteredAt = null;
      }

      return prismaClient.order.findMany({
        where,
        orderBy: { orderedAt: "desc" },
        take: limit,
      });
    },

    // 「CSVを作成」ボタン用(全件出力=orderNumbers未指定時)の状態ベース対象判定。
    // 対象 = orderStatus=300(発送待ち) かつ csvExportedAtが未設定。受注日には依存しない
    // (2026-08-25経営判断。findClickPostTargetOrdersと同じ方針)。待たせている時間が
    // 長い順(orderedAt昇順)に返す。件数上限は設けない(ClickPost側の1回のアップロード
    // 上限(40件)はCSV作成側で警告として扱う)。
    findCsvExportTargetOrders() {
      return prismaClient.order.findMany({
        where: { orderStatus: "300", csvExportedAt: null },
        orderBy: { orderedAt: "asc" },
      });
    },

    // CSV出力成功時に、実際にCSVへ含めた注文だけへ一括で記録する。選択実行時は
    // csvExportedAtの状態に関わらず対象に含めているため、再出力の場合もここで
    // 最新の出力日時に更新される(=ユーザーが選び直すことが明示的なリセット手段になる)。
    async markCsvExported(ids: string[], exportedAt: Date) {
      if (ids.length === 0) return { count: 0 };
      return prismaClient.order.updateMany({
        where: { id: { in: ids } },
        data: { csvExportedAt: exportedAt },
      });
    },

    // 発送エントリー画面の「本日のCSV出力実績」表示用。今日(JST)csvExportedAtが
    // 設定された注文の件数と、その中で最新のcsvExportedAtを返す。対象抽出ロジック
    // (findCsvExportTargetOrders等)とは無関係の、実績の可視化のみを目的とする。
    async getTodayCsvExportSummary(): Promise<{ count: number; lastExportedAt: Date | null }> {
      const { start, end } = getJstDayRange();
      const [count, latest] = await Promise.all([
        prismaClient.order.count({
          where: { csvExportedAt: { gte: start, lt: end } },
        }),
        prismaClient.order.findFirst({
          where: { csvExportedAt: { gte: start, lt: end } },
          orderBy: { csvExportedAt: "desc" },
          select: { csvExportedAt: true },
        }),
      ]);
      return { count, lastExportedAt: latest?.csvExportedAt ?? null };
    },
  };
}

export const orderRepository = createOrderRepository();
