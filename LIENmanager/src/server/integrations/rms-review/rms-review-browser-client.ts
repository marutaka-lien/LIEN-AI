import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { Download, Page } from "playwright";

import { loadRmsBrowserConfig } from "../rms/rms-browser-config";
import { getRmsBrowserContext } from "../rms/rms-browser-context";
import type { RmsReviewConfig } from "./rms-review-config";
import { RmsReviewDownloadError } from "./rms-review-errors";
import { reviewToolSelectors } from "./rms-review.selectors";

// レビューチェックツールのブラウザ操作のみを担当する層。RmsBrowserClient/
// ClickPostBrowserClientと同じ責務分離方針(CSVパース・DB反映は関知しない)。

export interface RmsReviewBrowserClient {
  // フィルタ操作なしでCSVダウンロードリンクをクリックし、ダウンロードしたファイルの
  // 絶対パス(一時ファイル)を返す。呼び出し側がパース後に削除すること。
  downloadReviewsCsv(): Promise<string>;
}

export interface RmsReviewBrowserClientDeps {
  config: RmsReviewConfig;
  // テスト用にPageを注入可能にする。省略時はRMSと共有のPersistent Contextを起動/再利用する。
  getPage?: () => Promise<Page>;
}

export function createRmsReviewBrowserClient(
  deps: RmsReviewBrowserClientDeps
): RmsReviewBrowserClient {
  const { config, getPage } = deps;

  async function resolvePage(): Promise<Page> {
    if (getPage) return getPage();

    // review.rms.rakuten.co.jpはRMSと同一R-Login SSOセッションのため、RMS用の
    // Persistent Contextプロファイルをそのまま共有できる(2026-08-06実画面で確認済み)。
    const context = await getRmsBrowserContext(loadRmsBrowserConfig());
    const pages = context.pages();
    return pages[pages.length - 1] ?? (await context.newPage());
  }

  async function downloadReviewsCsv(): Promise<string> {
    const page = await resolvePage();
    await page.goto(config.reviewToolUrl, { waitUntil: "networkidle" });

    const downloadLink = reviewToolSelectors.csvDownloadLink(page);
    let download: Download;
    try {
      [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 15000 }),
        downloadLink.click(),
      ]);
    } catch (error) {
      throw new RmsReviewDownloadError(
        `レビューCSVのダウンロードに失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const savePath = path.join(os.tmpdir(), `rms-reviews-${Date.now()}.csv`);
    await download.saveAs(savePath);

    if (!fs.existsSync(savePath)) {
      throw new RmsReviewDownloadError("ダウンロードしたレビューCSVの保存に失敗しました");
    }

    return savePath;
  }

  return { downloadReviewsCsv };
}

// 実運用向けのデフォルトファクトリ。
export function createDefaultRmsReviewBrowserClient(
  config: RmsReviewConfig
): RmsReviewBrowserClient {
  return createRmsReviewBrowserClient({ config });
}
