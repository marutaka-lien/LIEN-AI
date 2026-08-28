import path from "node:path";

import { z } from "zod";

import { RmsConfigError } from "./rms-errors";

// RmsApiClient(REST API)用の設定(rms-config.ts)とは別に、
// RmsBrowserClient(Playwright操作)専用の設定として分離する。
// URLは2026-07-22に実画面で確認済み。
const RmsBrowserEnvSchema = z.object({
  RMS_MAINMENU_URL: z.url().default("https://mainmenu.rms.rakuten.co.jp/rms"),
  RMS_ORDER_SEARCH_URL: z
    .url()
    .default("https://order-rp.rms.rakuten.co.jp/order-rb/search-order-sc/init"),
  RMS_ORDER_DETAIL_URL_TEMPLATE: z
    .string()
    .min(1)
    .default(
      "https://order-rp.rms.rakuten.co.jp/order-rb/individual-order-detail-sc/init?orderNumber={orderNumber}"
    ),
  RMS_ORDER_LIST_PENDING_CONFIRMATION_URL: z
    .url()
    .default(
      "https://order-rp.rms.rakuten.co.jp/order-rb/order-list-sc/init?&SEARCH_MODE=1&ORDER_PROGRESS=100"
    ),
  RMS_BROWSER_PROFILE_DIR: z.string().min(1).default("playwright/.auth/rms-profile"),
});

export interface RmsBrowserConfig {
  mainMenuUrl: string;
  orderSearchUrl: string;
  orderDetailUrlTemplate: string;
  orderListPendingConfirmationUrl: string;
  // 絶対パス。Persistent Contextの保存先(Git管理対象外)。
  profileDir: string;
}

export function loadRmsBrowserConfig(env: NodeJS.ProcessEnv = process.env): RmsBrowserConfig {
  const parsed = RmsBrowserEnvSchema.safeParse(env);

  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new RmsConfigError(`RMSブラウザ設定が不足または不正です: ${missing}`);
  }

  return {
    mainMenuUrl: parsed.data.RMS_MAINMENU_URL,
    orderSearchUrl: parsed.data.RMS_ORDER_SEARCH_URL,
    orderDetailUrlTemplate: parsed.data.RMS_ORDER_DETAIL_URL_TEMPLATE,
    orderListPendingConfirmationUrl: parsed.data.RMS_ORDER_LIST_PENDING_CONFIRMATION_URL,
    profileDir: path.resolve(process.cwd(), parsed.data.RMS_BROWSER_PROFILE_DIR),
  };
}

export function buildOrderDetailUrl(config: RmsBrowserConfig, orderNumber: string): string {
  return config.orderDetailUrlTemplate.replace("{orderNumber}", encodeURIComponent(orderNumber));
}
