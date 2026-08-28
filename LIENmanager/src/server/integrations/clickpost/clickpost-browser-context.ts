import { chromium, type BrowserContext } from "playwright";

import type { ClickPostBrowserConfig } from "./clickpost-config";

// rms-browser-context.tsと同じ理由(HMR時の多重起動防止、失敗Promiseの永続キャッシュ回避)で
// globalThisにキャッシュする。ClickPostはOAuthログイン(Yahoo!/Amazon)のため、
// ブラウザを閉じるとセッションが失われる可能性が高く、極力同じコンテキストを使い回す。

const globalForClickPostBrowser = globalThis as unknown as {
  clickPostBrowserContext?: Promise<BrowserContext>;
};

export function getClickPostBrowserContext(config: ClickPostBrowserConfig): Promise<BrowserContext> {
  if (!globalForClickPostBrowser.clickPostBrowserContext) {
    const launchPromise = chromium.launchPersistentContext(config.profileDir, {
      channel: "chrome",
      headless: false,
      viewport: { width: 1400, height: 900 },
    });
    launchPromise.catch(() => {
      if (globalForClickPostBrowser.clickPostBrowserContext === launchPromise) {
        globalForClickPostBrowser.clickPostBrowserContext = undefined;
      }
    });
    // 手動クローズ・クラッシュ等でブラウザが後から閉じられた場合もキャッシュを外す。
    // これが無いと閉じた後のcontextを永久に使い回し続け、newPage()が失敗し続ける
    // (rms-browser-context.tsで実際に291回連続失敗した不具合と同じパターン)。
    launchPromise.then((context) => {
      context.once("close", () => {
        if (globalForClickPostBrowser.clickPostBrowserContext === launchPromise) {
          globalForClickPostBrowser.clickPostBrowserContext = undefined;
        }
      });
    });
    globalForClickPostBrowser.clickPostBrowserContext = launchPromise;
  }
  return globalForClickPostBrowser.clickPostBrowserContext;
}

export async function closeClickPostBrowserContext(): Promise<void> {
  if (!globalForClickPostBrowser.clickPostBrowserContext) return;
  const context = await globalForClickPostBrowser.clickPostBrowserContext;
  await context.close();
  globalForClickPostBrowser.clickPostBrowserContext = undefined;
}
