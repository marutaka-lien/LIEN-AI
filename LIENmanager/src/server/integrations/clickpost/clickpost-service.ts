import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { Order } from "@/generated/prisma/client";

import {
  createDefaultClickPostBrowserClient,
  type ClickPostBrowserClient,
} from "./clickpost-browser-client";
import { loadClickPostBrowserConfig } from "./clickpost-config";
import { buildClickPostCsvBuffer } from "./clickpost-csv";
import { ClickPostConfigError, ClickPostIntegrationError } from "./clickpost-errors";
import { ClickPostMapper } from "./clickpost-mapper";
import type { ClickPostCsvRow } from "./clickpost-types";

export interface ClickPostDryRunResult {
  totalOrders: number;
  mappableCount: number;
  unmappableCount: number;
  // 氏名・住所等の個人情報を含む。呼び出し側でこの内容をログ・チャット等に
  // そのまま出力しないこと(必要なのは件数・成功可否のみ)。
  rows: ClickPostCsvRow[];
  errors: Array<{ orderNumber: string; reason: string }>;
}

export interface ClickPostRegisterResult {
  orderNumber: string;
  // まとめ申込〜確認画面〜支払手続き画面まで到達できたか。
  // 決済自体はGoQSystem側で行う業務フローに確定したため、ここでは行わない。
  reachedPaymentScreen: boolean;
}

export interface ClickPostTrackingResult {
  orderNumber: string;
  recipientName: string;
  trackingNumber: string | null;
}

export interface ClickPostService {
  // OrderをClickPost登録データへ変換するのみ。ClickPostへは一切アクセスしない。
  dryRunMapOrders(orders: Order[]): ClickPostDryRunResult;

  // まとめ申込(CSVアップロード〜確認画面〜支払手続き画面到達)まで自動で行う。
  // 決済ボタンはクリックしない(GoQSystem等、自社アプリの外で行う運用)。
  // execute:trueが明示されない限り実行しない(安全のためのdry run/executeフラグ)。
  registerOrders(orders: Order[], options: { execute: boolean }): Promise<ClickPostRegisterResult[]>;

  // 決済・印字が完了した後、マイページ発送履歴から追跡番号を取得する。
  fetchTrackingNumbers(orders: Order[]): Promise<ClickPostTrackingResult[]>;
}

export interface ClickPostServiceDeps {
  browserClient?: ClickPostBrowserClient;
}

export function createClickPostService(deps: ClickPostServiceDeps = {}): ClickPostService {
  function requireBrowserClient(): ClickPostBrowserClient {
    if (!deps.browserClient) {
      throw new ClickPostConfigError("ClickPostBrowserClientが設定されていません");
    }
    return deps.browserClient;
  }

  function dryRunMapOrders(orders: Order[]): ClickPostDryRunResult {
    const rows: ClickPostCsvRow[] = [];
    const errors: Array<{ orderNumber: string; reason: string }> = [];

    for (const order of orders) {
      try {
        rows.push(ClickPostMapper.toCsvRow(order));
      } catch (error) {
        errors.push({
          orderNumber: order.orderNumber,
          reason: error instanceof Error ? error.message : "unknown error",
        });
      }
    }

    return {
      totalOrders: orders.length,
      mappableCount: rows.length,
      unmappableCount: errors.length,
      rows,
      errors,
    };
  }

  async function registerOrders(
    orders: Order[],
    options: { execute: boolean }
  ): Promise<ClickPostRegisterResult[]> {
    if (!options.execute) {
      return orders.map((order) => ({ orderNumber: order.orderNumber, reachedPaymentScreen: false }));
    }

    const browserClient = requireBrowserClient();

    const loginState = await browserClient.checkLoginState();
    if (loginState !== "logged_in") {
      throw new ClickPostIntegrationError(
        "ClickPostにログインしていません。表示されているブラウザで手動ログインしてください。"
      );
    }

    const rows = orders.map((order) => ClickPostMapper.toCsvRow(order));
    const csvBuffer = buildClickPostCsvBuffer(rows);
    const csvPath = path.join(os.tmpdir(), `clickpost-upload-${Date.now()}.csv`);

    try {
      await browserClient.navigateToBulkApplication();
      fs.writeFileSync(csvPath, csvBuffer);

      const uploadResult = await browserClient.uploadCsv(csvPath);
      if (!uploadResult.reachedConfirmationScreen || uploadResult.hasValidationError) {
        throw new ClickPostIntegrationError(
          `まとめ申込の確認画面に到達できませんでした(reachedConfirmationScreen=${uploadResult.reachedConfirmationScreen}, hasValidationError=${uploadResult.hasValidationError})`
        );
      }

      const paymentResult = await browserClient.proceedToPaymentScreen();
      if (!paymentResult.reachedPaymentScreen) {
        throw new ClickPostIntegrationError("支払手続き画面に到達できませんでした");
      }

      // 決済はGoQSystem側で行う運用のため、ここで止める。
      return orders.map((order) => ({ orderNumber: order.orderNumber, reachedPaymentScreen: true }));
    } finally {
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    }
  }

  async function fetchTrackingNumbers(orders: Order[]): Promise<ClickPostTrackingResult[]> {
    const browserClient = requireBrowserClient();

    const recipientNames = orders.map((order) => order.recipientName ?? order.ordererName);
    const results = await browserClient.fetchTrackingNumbers(recipientNames);

    return orders.map((order, index) => ({
      orderNumber: order.orderNumber,
      recipientName: recipientNames[index],
      trackingNumber: results[index]?.trackingNumber ?? null,
    }));
  }

  return { dryRunMapOrders, registerOrders, fetchTrackingNumbers };
}

// 実運用向けのデフォルトファクトリ(実際の環境変数・Persistent Contextを使用する)。
export function createDefaultClickPostService(): ClickPostService {
  const config = loadClickPostBrowserConfig();
  const browserClient = createDefaultClickPostBrowserClient(config);
  return createClickPostService({ browserClient });
}
