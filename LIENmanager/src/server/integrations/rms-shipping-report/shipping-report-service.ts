// 「発送完了報告CSVを作る」機能のサーバー側オーケストレーション。
// 前回失敗した RMS 書き戻し API(rms-service.ts の reflectTrackingNumber 等)には
// 一切依存しない。注文データの読み取り + shippingReportedAt の記録のみ行う。

import type { Order } from "@/generated/prisma/client";
import { orderRepository } from "@/server/order/order.repository";

import { classifyShippingReport } from "./classify";
import { parseClickPostTrackingCsv } from "./clickpost-tracking-csv";
import {
  buildShippingReportCsvBuffer,
  buildShippingReportCsvFilename,
  findUnsafeTrackingNumbers,
} from "./upload-csv";
import {
  MAX_ROWS_PER_UPLOAD,
  type ShippingReportClassification,
  type ShippingReportTargetOrder,
} from "./rms-shipping-report-types";

// yyyy-mm-dd かどうか(存在する日付かまでは厳密チェックしない。RMS側でも検証される)。
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidShippingDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toTargetOrder(order: Order): ShippingReportTargetOrder {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    recipientName: order.recipientName,
    ordererName: order.ordererName,
    postalCode: order.postalCode,
    prefecture: order.prefecture,
    address1: order.address1,
    address2: order.address2,
    orderedAt: order.orderedAt,
    rawPayload: order.rawPayload,
  };
}

export interface ConvertPreview {
  classification: ShippingReportClassification;
  targetOrderCount: number;
  headerWarning?: string;
  droppedRowNumbers: number[];
  unsafeTracking: Array<{ orderNumber: string; trackingNumber: string }>;
  exceedsRowLimit: boolean;
}

async function loadClassification(
  fileBuffer: Buffer,
  shippingDate: string,
  excludeOrderNumbers: string[]
): Promise<{ preview: ConvertPreview }> {
  const parsed = parseClickPostTrackingCsv(fileBuffer);
  const orders = await orderRepository.findShippingReportTargetOrders();
  const targetOrders = orders.map(toTargetOrder);

  const classification = classifyShippingReport({
    orders: targetOrders,
    trackingRows: parsed.rows,
    shippingDate,
    excludeOrderNumbers,
  });

  return {
    preview: {
      classification,
      targetOrderCount: targetOrders.length,
      headerWarning: parsed.headerWarning,
      droppedRowNumbers: parsed.droppedRowNumbers,
      unsafeTracking: findUnsafeTrackingNumbers(classification.csvRows),
      exceedsRowLimit: classification.csvRows.length > MAX_ROWS_PER_UPLOAD,
    },
  };
}

export const shippingReportService = {
  // プレビュー用。DBは一切変更しない。
  async preview(fileBuffer: Buffer, shippingDate: string): Promise<ConvertPreview> {
    const { preview } = await loadClassification(fileBuffer, shippingDate, []);
    return preview;
  },

  // ダウンロード用。CSVを組み立て、実際に含めた注文へ shippingReportedAt を記録する。
  async buildCsvAndMark(
    fileBuffer: Buffer,
    shippingDate: string,
    excludeOrderNumbers: string[],
    now: Date = new Date()
  ): Promise<{
    csvBuffer: Buffer;
    filename: string;
    preview: ConvertPreview;
    markedCount: number;
  }> {
    const { preview } = await loadClassification(fileBuffer, shippingDate, excludeOrderNumbers);
    const { classification } = preview;

    const csvBuffer = buildShippingReportCsvBuffer(classification.csvRows);
    const filename = buildShippingReportCsvFilename(now);

    // CSVへ含めた注文(autoMatched + representative)だけを出力済みにする。
    const includedOrderIds = [
      ...classification.autoMatched,
      ...classification.representative,
    ].map((pair) => pair.orderId);
    const { count } = await orderRepository.markShippingReported(includedOrderIds, now);

    return { csvBuffer, filename, preview, markedCount: count };
  },
};
