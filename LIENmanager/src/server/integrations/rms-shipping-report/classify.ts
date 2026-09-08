// クリックポストの追跡番号(X)と、変換対象の注文(orders)を宛先で突き合わせ、
// RMSアップロード用CSVに出す行と、人手が要る各区分に振り分ける。
//
// 呼び出し側の前提: orders は「orderStatus=300 かつ shippingReportedAt=null」で
// すでに絞り込み済み(findShippingReportTargetOrders)。ここでは日付(180日)と
// 宛先の対応関係だけを見る。

import type {
  ShippingReportClassification,
  ShippingReportMatchedPair,
} from "@/types/shipping-report";

import { buildAddressKey, buildOrderAddressKey } from "./address-key";
import {
  DELIVERY_COMPANY_JAPAN_POST,
  MAX_ORDER_AGE_DAYS,
  type ClickPostTrackingRow,
  type ShippingReportCsvRow,
  type ShippingReportTargetOrder,
} from "./rms-shipping-report-types";

export interface ClassifyInput {
  orders: ShippingReportTargetOrder[];
  trackingRows: ClickPostTrackingRow[];
  // yyyy-mm-dd。全行に同じ発送日を入れる。
  shippingDate: string;
  now?: Date;
  // 同一宛先グループで代表1件を出力するか(既定 true)。false にすると曖昧なグループは
  // 一切CSVに出さず、すべて要確認へ回す。
  pairRepresentative?: boolean;
  // プレビューでチェックを外された注文番号(この注文はCSVに含めない)。
  excludeOrderNumbers?: Iterable<string>;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// 注文番号から注文日(yyyymmdd)を取り出す。楽天の注文番号は "店舗ID-yyyymmdd-連番"。
// 取り出せなければ null(=日付判定をスキップし、期限切れ扱いにはしない)。
export function parseOrderedOnFromOrderNumber(orderNumber: string): Date | null {
  const dashed = orderNumber.match(/-(\d{8})-/);
  const raw = dashed?.[1] ?? orderNumber.match(/(20\d{6})/)?.[1];
  if (!raw) return null;
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function orderedOnLabel(order: ShippingReportTargetOrder): string | null {
  return toIsoDate(parseOrderedOnFromOrderNumber(order.orderNumber) ?? order.orderedAt ?? null);
}

// rawPayload(RMS getOrder 生データ)に複数の送付先がある可能性を、読み取りのみで判定する。
// 前回失敗した書き戻しコードには一切触れない。壊れていれば false。
export function hasMultiplePackages(order: ShippingReportTargetOrder): boolean {
  if (!order.rawPayload) return false;
  try {
    const parsed = JSON.parse(order.rawPayload) as { PackageModelList?: unknown };
    return Array.isArray(parsed.PackageModelList) && parsed.PackageModelList.length > 1;
  } catch {
    return false;
  }
}

function displayName(order: ShippingReportTargetOrder): string {
  return order.recipientName ?? order.ordererName;
}

function toPair(
  order: ShippingReportTargetOrder,
  trackingNumber: string
): ShippingReportMatchedPair {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    recipientName: displayName(order),
    trackingNumber,
    orderedOn: orderedOnLabel(order),
  };
}

function toCsvRow(pair: ShippingReportMatchedPair, shippingDate: string): ShippingReportCsvRow {
  return {
    orderNumber: pair.orderNumber,
    shippingTrackingNumber: pair.trackingNumber,
    deliveryCompany: DELIVERY_COMPANY_JAPAN_POST,
    shippingDate,
  };
}

// 最古の注文を代表に選ぶ。orderedAt が無いものは後ろ回し。同着は注文番号の昇順。
function pickRepresentativeOrder(orders: ShippingReportTargetOrder[]): ShippingReportTargetOrder {
  return [...orders].sort((a, b) => {
    const at = a.orderedAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const bt = b.orderedAt?.getTime() ?? Number.POSITIVE_INFINITY;
    if (at !== bt) return at - bt;
    return a.orderNumber.localeCompare(b.orderNumber);
  })[0];
}

export function classifyShippingReport(input: ClassifyInput): ShippingReportClassification {
  const {
    orders,
    trackingRows,
    shippingDate,
    now = new Date(),
    pairRepresentative = true,
    excludeOrderNumbers,
  } = input;

  const excluded = new Set(excludeOrderNumbers ?? []);
  const cutoff = now.getTime() - MAX_ORDER_AGE_DAYS * MS_PER_DAY;

  const result: ShippingReportClassification = {
    autoMatched: [],
    representative: [],
    needsReview: [],
    skippedExpired: [],
    unmatchedOrders: [],
    unmatchedTracking: [],
    csvRows: [],
  };

  // --- 追跡番号側をキーでグルーピング(キー不成立は即 未マッチ) ---
  const trackingByKey = new Map<string, ClickPostTrackingRow[]>();
  for (const row of trackingRows) {
    const key = buildAddressKey({
      postalCode: row.postalCode,
      name: row.recipientName,
      address: row.address,
    });
    if (!key) {
      result.unmatchedTracking.push({
        trackingNumber: row.trackingNumber,
        recipientName: row.recipientName,
        sourceRowNumber: row.sourceRowNumber,
      });
      continue;
    }
    const bucket = trackingByKey.get(key);
    if (bucket) bucket.push(row);
    else trackingByKey.set(key, [row]);
  }
  const usedTrackingKeys = new Set<string>();

  // --- 注文側をキーでグルーピング ---
  const ordersByKey = new Map<string, ShippingReportTargetOrder[]>();
  for (const order of orders) {
    if (excluded.has(order.orderNumber)) continue;
    const key = buildOrderAddressKey(order);
    if (!key) {
      // 宛先が欠けていてキーが作れない = 突き合わせ不能。人手へ。
      result.unmatchedOrders.push({
        orderNumber: order.orderNumber,
        recipientName: displayName(order),
      });
      continue;
    }
    const bucket = ordersByKey.get(key);
    if (bucket) bucket.push(order);
    else ordersByKey.set(key, [order]);
  }

  // --- キー単位で突き合わせ ---
  for (const [key, groupOrders] of ordersByKey) {
    const groupTracking = trackingByKey.get(key) ?? [];
    if (groupTracking.length > 0) usedTrackingKeys.add(key);

    // 180日判定。取り出せない注文は期限切れにしない。
    const valid: ShippingReportTargetOrder[] = [];
    for (const order of groupOrders) {
      const orderedOn = parseOrderedOnFromOrderNumber(order.orderNumber);
      if (orderedOn && orderedOn.getTime() < cutoff) {
        result.skippedExpired.push({
          orderNumber: order.orderNumber,
          recipientName: displayName(order),
          orderedOn: toIsoDate(orderedOn),
        });
      } else {
        valid.push(order);
      }
    }

    if (valid.length === 0) continue; // 期限切ればかり。追跡番号の扱いは下の未使用判定で拾う。

    if (groupTracking.length === 0) {
      for (const order of valid) {
        result.unmatchedOrders.push({
          orderNumber: order.orderNumber,
          recipientName: displayName(order),
        });
      }
      continue;
    }

    const multiple =
      valid.length > 1 || groupTracking.length > 1 || hasMultiplePackages(valid[0]);

    if (!multiple) {
      const pair = toPair(valid[0], groupTracking[0].trackingNumber);
      result.autoMatched.push(pair);
      result.csvRows.push(toCsvRow(pair, shippingDate));
      continue;
    }

    // 曖昧なグループ: 代表1件だけCSVへ、残りは要確認。
    const repOrder = pickRepresentativeOrder(valid);
    const repTracking = [...groupTracking].sort(
      (a, b) => a.sourceRowNumber - b.sourceRowNumber
    )[0];

    if (pairRepresentative) {
      const pair = toPair(repOrder, repTracking.trackingNumber);
      result.representative.push(pair);
      result.csvRows.push(toCsvRow(pair, shippingDate));
    } else {
      result.needsReview.push({
        orderNumber: repOrder.orderNumber,
        recipientName: displayName(repOrder),
        trackingNumber: repTracking.trackingNumber,
        reason: "multiple-in-group",
      });
    }

    for (const order of valid) {
      if (order.orderNumber === repOrder.orderNumber) {
        if (hasMultiplePackages(order)) {
          result.needsReview.push({
            orderNumber: order.orderNumber,
            recipientName: displayName(order),
            trackingNumber: repTracking.trackingNumber,
            reason: "multiple-packages",
          });
        }
        continue;
      }
      result.needsReview.push({
        orderNumber: order.orderNumber,
        recipientName: displayName(order),
        trackingNumber: null,
        reason: "multiple-in-group",
      });
    }
    for (const row of groupTracking) {
      if (row.sourceRowNumber === repTracking.sourceRowNumber) continue;
      result.needsReview.push({
        orderNumber: null,
        recipientName: row.recipientName,
        trackingNumber: row.trackingNumber,
        reason: "multiple-in-group",
      });
    }
  }

  // --- どの注文キーにも対応しなかった追跡番号 ---
  for (const [key, rows] of trackingByKey) {
    if (usedTrackingKeys.has(key)) continue;
    for (const row of rows) {
      result.unmatchedTracking.push({
        trackingNumber: row.trackingNumber,
        recipientName: row.recipientName,
        sourceRowNumber: row.sourceRowNumber,
      });
    }
  }

  result.csvRows.sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));
  return result;
}
