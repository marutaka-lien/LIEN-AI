import { chromium, type BrowserContext } from "playwright";

import type { RmsBrowserConfig } from "./rms-browser-config";

// Prisma同様(src/server/db/prisma.ts)、開発時のHMRで複数のPersistent Contextが
// 起動しないようグローバルにキャッシュする。ブラウザを閉じるとRMSの再ログインが
// 必要になる可能性があるため(2026-07-22実データで確認済み)、同一プロセス内では
// 極力同じコンテキストを使い回し、明示的にcloseRmsBrowserContext()を呼ぶまで維持する。

const globalForRmsBrowser = globalThis as unknown as {
  rmsBrowserContext?: Promise<BrowserContext>;
};

export function getRmsBrowserContext(config: RmsBrowserConfig): Promise<BrowserContext> {
  if (!globalForRmsBrowser.rmsBrowserContext) {
    const launchPromise = chromium.launchPersistentContext(config.profileDir, {
      channel: "chrome",
      headless: false,
      viewport: { width: 1400, height: 900 },
    });
    // 起動に失敗した場合はキャッシュを外し、次回呼び出し時に再試行できるようにする
    // (失敗したPromiseを永久にキャッシュし続けるバグを避ける)。
    launchPromise.catch(() => {
      if (globalForRmsBrowser.rmsBrowserContext === launchPromise) {
        globalForRmsBrowser.rmsBrowserContext = undefined;
      }
    });
    // 手動クローズ・クラッシュ・OSスリープ等でブラウザが後から閉じられた場合もキャッシュを外す。
    // これが無いと閉じた後のcontextを永久に使い回し続け、newPage()が
    // "Target page, context or browser has been closed" で失敗し続ける。
    launchPromise.then((context) => {
      context.once("close", () => {
        if (globalForRmsBrowser.rmsBrowserContext === launchPromise) {
          globalForRmsBrowser.rmsBrowserContext = undefined;
        }
      });
    });
    globalForRmsBrowser.rmsBrowserContext = launchPromise;
  }
  return globalForRmsBrowser.rmsBrowserContext;
}

export async function closeRmsBrowserContext(): Promise<void> {
  if (!globalForRmsBrowser.rmsBrowserContext) return;
  const context = await globalForRmsBrowser.rmsBrowserContext;
  await context.close();
  globalForRmsBrowser.rmsBrowserContext = undefined;
}
