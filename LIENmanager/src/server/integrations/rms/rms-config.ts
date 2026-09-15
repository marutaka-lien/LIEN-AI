import { z } from "zod";

import { RmsConfigError } from "./rms-errors";

const RmsEnvSchema = z.object({
  RMS_SERVICE_SECRET: z.string().min(1, "RMS_SERVICE_SECRET is required"),
  RMS_LICENSE_KEY: z.string().min(1, "RMS_LICENSE_KEY is required"),
  // 実APIへのDry Run(2026-07-22実施)で疎通確認済み。
  RMS_API_BASE_URL: z.url("RMS_API_BASE_URL must be a valid URL"),
  RMS_SEARCH_ORDER_PATH: z.string().min(1).default("/es/2.0/order/searchOrder/"),
  RMS_GET_ORDER_PATH: z.string().min(1).default("/es/2.0/order/getOrder/"),
  // 実データへのテスト呼び出しで疎通・必須パラメータを確認済み(2026-07-29)。
  RMS_UPDATE_ORDER_SHIPPING_PATH: z.string().min(1).default("/es/2.0/order/updateOrderShipping/"),
  // getOrderの必須パラメータ。1・2は不正値として拒否され、3で成功することを確認済み。
  RMS_GET_ORDER_VERSION: z.coerce.number().int().min(1).default(3),
  RMS_SEARCH_LOOKBACK_DAYS: z.coerce.number().int().min(1).max(63).default(14),
  RMS_SEARCH_MAX_WINDOW_DAYS: z.coerce.number().int().min(1).max(63).default(63),
  RMS_SEARCH_MAX_RECORDS_PER_PAGE: z.coerce.number().int().min(1).max(1000).default(200),
  RMS_REQUEST_INTERVAL_MS: z.coerce.number().int().min(0).default(1000),
  RMS_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
  // 商品API 2.0(items.search)。実APIへの疎通確認(2026-09-15)でGET+この形式、
  // かつhitsは1〜100の範囲であることを確認済み(超えるとIE0003エラー)。
  RMS_ITEM_SEARCH_PATH: z.string().min(1).default("/es/2.0/items/search"),
  RMS_ITEM_SEARCH_HITS: z.coerce.number().int().min(1).max(100).default(100),
  // 商品画像(R-Cabinet)のURLは https://image.rakuten.co.jp/{ショップURL}/cabinet{location}
  // で配信されることを実画像への疎通確認(2026-09-15)で確認済み。ショップURLは非公開情報ではない
  // (楽天市場の店舗ページURL: https://item.rakuten.co.jp/lien-ame/)。
  RMS_SHOP_URL: z.string().min(1).default("lien-ame"),
  // 在庫API 2.0(inventories.bulk-get)。実APIへの疎通確認(2026-09-15)で
  // POST + {inventories:[{manageNumber,variantId}]} 形式、691件一括でも成功することを確認済み。
  RMS_INVENTORY_BULK_GET_PATH: z.string().min(1).default("/es/2.0/inventories/bulk-get"),
});

export interface RmsConfig {
  baseUrl: string;
  searchOrderPath: string;
  getOrderPath: string;
  updateOrderShippingPath: string;
  getOrderVersion: number;
  authHeader: string;
  searchLookbackDays: number;
  searchMaxWindowDays: number;
  searchMaxRecordsPerPage: number;
  requestIntervalMs: number;
  requestTimeoutMs: number;
  itemSearchPath: string;
  itemSearchHits: number;
  itemImageBaseUrl: string;
  inventoryBulkGetPath: string;
}

// 環境変数はモジュール読み込み時ではなく、実際にRMSへアクセスするタイミングで検証する。
// (RMS未設定でもダッシュボード等、アプリの他機能を起動できるようにするため)
export function loadRmsConfig(env: NodeJS.ProcessEnv = process.env): RmsConfig {
  const parsed = RmsEnvSchema.safeParse(env);

  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new RmsConfigError(`RMS設定が不足または不正です: ${missing}`);
  }

  const data = parsed.data;
  const authHeader = buildAuthHeader(data.RMS_SERVICE_SECRET, data.RMS_LICENSE_KEY);

  return {
    baseUrl: data.RMS_API_BASE_URL,
    searchOrderPath: data.RMS_SEARCH_ORDER_PATH,
    getOrderPath: data.RMS_GET_ORDER_PATH,
    updateOrderShippingPath: data.RMS_UPDATE_ORDER_SHIPPING_PATH,
    getOrderVersion: data.RMS_GET_ORDER_VERSION,
    authHeader,
    searchLookbackDays: data.RMS_SEARCH_LOOKBACK_DAYS,
    searchMaxWindowDays: data.RMS_SEARCH_MAX_WINDOW_DAYS,
    searchMaxRecordsPerPage: data.RMS_SEARCH_MAX_RECORDS_PER_PAGE,
    requestIntervalMs: data.RMS_REQUEST_INTERVAL_MS,
    requestTimeoutMs: data.RMS_REQUEST_TIMEOUT_MS,
    itemSearchPath: data.RMS_ITEM_SEARCH_PATH,
    itemSearchHits: data.RMS_ITEM_SEARCH_HITS,
    itemImageBaseUrl: `https://image.rakuten.co.jp/${data.RMS_SHOP_URL}/cabinet`,
    inventoryBulkGetPath: data.RMS_INVENTORY_BULK_GET_PATH,
  };
}

function buildAuthHeader(serviceSecret: string, licenseKey: string): string {
  const token = Buffer.from(`${serviceSecret}:${licenseKey}`).toString("base64");
  return `ESA ${token}`;
}
