import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/server/db/prisma";
import { getJstDayRange, getRecentDaysStart } from "@/lib/date";
import type { OrderUpsertInput, ShippingSegment, ShippingSegmentCounts } from "@/types/order";

// 発送エントリー「作業メニュー」の作業中/処理済みセグメントは直近7日で絞る
// (Gram/課題_発送ページ集約の実装_2026-09-10.md)。
const SHIPPING_SEGMENT_RECENT_DAYS = 7;

// 各セグメントのWhere条件。findSegmentOrders/countShippingSegmentsで共有する
// (2箇所で判定がずれるのを防ぐため、必ずここを経由する)。
function segmentWhere(segment: ShippingSegment, now: Date): Prisma.OrderWhereInput {
  const recentSince = getRecentDaysStart(SHIPPING_SEGMENT_RECENT_DAYS, now);
  switch (segment) {
    case "awaiting":
      return { orderStatus: "100" };
    case "unprocessed":
      return { orderStatus: "300", csvExportedAt: null, heldAt: null };
    case "inProgress":
      // gte指定だけでnull(未出力)は自動的に除外される。
      return {
        csvExportedAt: { gte: recentSince },
        shippingReportedAt: null,
      };
    case "done":
      return { shippingReportedAt: { gte: recentSince } };
    case "held":
      return { heldAt: { not: null } };
  }
}

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
    // 対象 = orderStatus=300(発送待ち) かつ csvExportedAtが未設定 かつ 一時保存でない。
    // 受注日には依存しない(2026-08-25経営判断。findClickPostTargetOrdersと同じ方針)。
    // heldAt(一時保存)除外は2026-09-10発送ページ集約で追加(選択実行時はこの判定を経由
    // しないため、一時保存中の注文でも選び直せば従来どおりCSV化できる)。待たせている
    // 時間が長い順(orderedAt昇順)に返す。件数上限は設けない(ClickPost側の1回の
    // アップロード上限(40件)はCSV作成側で警告として扱う)。
    findCsvExportTargetOrders() {
      return prismaClient.order.findMany({
        where: { orderStatus: "300", csvExportedAt: null, heldAt: null },
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

    // 「発送完了報告CSVを作る」(クリックポスト追跡番号 → RMS発送完了報告データCSV)の
    // 変換対象判定。findCsvExportTargetOrders と同じ「状態ベース」の方針:
    // 対象 = orderStatus=300(発送待ち) かつ shippingReportedAt が未設定。受注日には依存しない
    // (日付判定は変換側で「注文日から180日以内」を別途行う)。古い注文から順(orderedAt昇順)。
    findShippingReportTargetOrders() {
      return prismaClient.order.findMany({
        where: { orderStatus: "300", shippingReportedAt: null },
        orderBy: { orderedAt: "asc" },
      });
    },

    // 発送完了報告CSVへ実際に含めた注文だけへ、出力日時を一括記録する。
    // 二度流し(RMSへID空でアップした際の複数個口の二重登録)防止の一次ソース。
    // markCsvExported と同型。再出力(プレビューで明示的に選び直し)の場合もここで
    // 最新の日時へ更新される。
    async markShippingReported(ids: string[], reportedAt: Date) {
      if (ids.length === 0) return { count: 0 };
      return prismaClient.order.updateMany({
        where: { id: { in: ids } },
        data: { shippingReportedAt: reportedAt },
      });
    },

    // 発送完了報告CSVの「本日の実績」表示用。getTodayCsvExportSummary と同じ考え方で、
    // 今日(JST)shippingReportedAt が設定された注文の件数と最新日時を返す。
    async getTodayShippingReportSummary(): Promise<{ count: number; lastReportedAt: Date | null }> {
      const { start, end } = getJstDayRange();
      const [count, latest] = await Promise.all([
        prismaClient.order.count({
          where: { shippingReportedAt: { gte: start, lt: end } },
        }),
        prismaClient.order.findFirst({
          where: { shippingReportedAt: { gte: start, lt: end } },
          orderBy: { shippingReportedAt: "desc" },
          select: { shippingReportedAt: true },
        }),
      ]);
      return { count, lastReportedAt: latest?.shippingReportedAt ?? null };
    },

    // 発送エントリー「作業メニュー」タブ(2026-09-10 発送ページ集約)。
    // 5セグメントすべての件数を1回で返す(上部フローバー表示用)。
    async countShippingSegments(now: Date = new Date()): Promise<ShippingSegmentCounts> {
      const segments: ShippingSegment[] = ["awaiting", "unprocessed", "inProgress", "done", "held"];
      const counts = await Promise.all(
        segments.map((segment) => prismaClient.order.count({ where: segmentWhere(segment, now) }))
      );
      return {
        awaiting: counts[0],
        unprocessed: counts[1],
        inProgress: counts[2],
        done: counts[3],
        held: counts[4],
      };
    },

    // 選択中セグメントの対象一覧(左のリスト用)。件数上限を設ける(画面に出しきれる
    // 範囲。まとめ処理の対象自体はfindCsvExportTargetOrders等、上限なしの別メソッドを使う)。
    // 並び順: 確認待ち/未処理/作業中は待たせている時間が長い順(orderedAt/csvExportedAt昇順)、
    // 処理済みは新しく完了した順、一時保存は退避してから長く経つ順。
    findSegmentOrders(segment: ShippingSegment, limit = 200, now: Date = new Date()) {
      const orderBy: Prisma.OrderOrderByWithRelationInput =
        segment === "inProgress"
          ? { csvExportedAt: "asc" }
          : segment === "done"
            ? { shippingReportedAt: "desc" }
            : segment === "held"
              ? { heldAt: "asc" }
              : { orderedAt: "asc" };

      return prismaClient.order.findMany({
        where: segmentWhere(segment, now),
        orderBy,
        take: limit,
      });
    },

    // 「一時保存にする」/「未処理へ戻す」「一時保存から外す」の切り替え。
    // heldAt以外のフィールドには一切触れない(RMS同期でも自動で戻したり消したりしない)。
    setHeld(id: string, heldAt: Date | null) {
      return prismaClient.order.update({ where: { id }, data: { heldAt } });
    },

    async setHeldMany(ids: string[], heldAt: Date | null) {
      if (ids.length === 0) return { count: 0 };
      return prismaClient.order.updateMany({ where: { id: { in: ids } }, data: { heldAt } });
    },

    // 発送エントリー「注文者情報一覧」タブ用。全ステータス・全期間を対象に、
    // 検索(注文番号・氏名の部分一致)/ステータス絞り込み/並べ替え/ページ送りに対応する。
    async findOrderDirectory(params: {
      search?: string;
      status?: string;
      sort?: "orderedAtDesc" | "orderedAtAsc";
      page?: number;
      pageSize?: number;
    }) {
      const { search, status, sort = "orderedAtDesc", page = 1, pageSize = 50 } = params;

      const where: Prisma.OrderWhereInput = {};
      if (status) where.orderStatus = status;
      if (search && search.trim().length > 0) {
        const term = search.trim();
        where.OR = [
          { orderNumber: { contains: term } },
          { ordererName: { contains: term } },
          { recipientName: { contains: term } },
        ];
      }

      const orderBy: Prisma.OrderOrderByWithRelationInput = {
        orderedAt: sort === "orderedAtAsc" ? "asc" : "desc",
      };

      const [orders, total] = await Promise.all([
        prismaClient.order.findMany({
          where,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prismaClient.order.count({ where }),
      ]);

      return { orders, total };
    },

    // ダッシュボード「今日のオペレーション」の現在値・出荷パイプライン用。
    // すべて状態ベース(受注日には依存しない。findCsvExportTargetOrders 等と同じ方針):
    //   awaitingConfirm  = 注文確認待ち(100)
    //   pendingShip      = 発送待ち(300) かつ ClickPost 未登録
    //   csvUnexported    = 発送待ち(300) かつ CSV 未出力
    //   csvExported      = 発送待ち(300) かつ CSV 出力済み
    async countOperationsOverview(): Promise<{
      awaitingConfirm: number;
      pendingShip: number;
      csvUnexported: number;
      csvExported: number;
    }> {
      const [awaitingConfirm, pendingShip, csvUnexported, csvExported] = await Promise.all([
        prismaClient.order.count({ where: { orderStatus: "100" } }),
        prismaClient.order.count({ where: { orderStatus: "300", clickPostRegisteredAt: null } }),
        prismaClient.order.count({ where: { orderStatus: "300", csvExportedAt: null } }),
        prismaClient.order.count({ where: { orderStatus: "300", csvExportedAt: { not: null } } }),
      ]);
      return { awaitingConfirm, pendingShip, csvUnexported, csvExported };
    },

    // ダッシュボード「本日の処理推移」用。今日(JST)の受注時刻・発送完了報告時刻の一覧だけを返す
    // (氏名・住所などの詳細は含めない)。時間帯別の累計集計は UI 側の純粋関数で行う
    // (2026-09-09 マスター決定: 既存データの範囲で作る／集計テーブルは追加しない)。
    async getTodayOrderTimeline(): Promise<{ orderedAt: Date[]; shippedAt: Date[] }> {
      const { start, end } = getJstDayRange();
      const [ordered, shipped] = await Promise.all([
        prismaClient.order.findMany({
          where: { orderedAt: { gte: start, lt: end } },
          select: { orderedAt: true },
        }),
        prismaClient.order.findMany({
          where: { shippingReportedAt: { gte: start, lt: end } },
          select: { shippingReportedAt: true },
        }),
      ]);
      return {
        orderedAt: ordered
          .map((row) => row.orderedAt)
          .filter((value): value is Date => value != null),
        shippedAt: shipped
          .map((row) => row.shippingReportedAt)
          .filter((value): value is Date => value != null),
      };
    },
  };
}

export const orderRepository = createOrderRepository();
