import path from "node:path";

import type { Page } from "playwright";

import type { RmsBrowserConfig } from "./rms-browser-config";
import { getRmsBrowserContext } from "./rms-browser-context";
import { bulkActionSelectors, mainMenuSelectors, orderListSelectors } from "./selectors";

// RMSのブラウザ画面をPlaywrightで操作する層。責務はブラウザ操作のみとし、
// 「いつ・どの注文を確認すべきか」といった業務ロジックはRmsService側に置く。
// ClickPostやAutomationJobについては一切関知しない。

export type RmsLoginState = "logged_in" | "needs_login";

export interface RmsPendingConfirmationScreenCheck {
  // 「処理中」画面(注文確認待ちタブ)に到達し、タブ・一括処理メニューを認識できたか。
  tabVisible: boolean;
  bulkMenuVisible: boolean;
}

export interface RmsConfirmOrderResult {
  orderNumber: string;
  // 対象注文が検索結果で見つかったか。
  found: boolean;
  // 実際に「注文確認」ボタンをクリックしたか(execute:falseの場合は常にfalse)。
  executed: boolean;
  // クリックまで到達し例外が発生しなかったか。RMS側の最終的な状態変更の
  // 確認はRmsService側でAPI(searchOrder/getOrder)を使って行うこと。
  success: boolean;
  screenshotPath?: string;
  errorMessage?: string;
}

export interface RmsBrowserClient {
  checkLoginState(): Promise<RmsLoginState>;
  verifyPendingConfirmationScreen(): Promise<RmsPendingConfirmationScreenCheck>;
  // options.executeがtrueの場合のみ実際に「注文確認」ボタンをクリックする。
  // 通常の自動化フローでは呼び出し側が明示的にtrueを渡さない限り、
  // ドライラン(検索・特定まで実施しクリックはしない)として振る舞う。
  confirmOrder(orderNumber: string, options: { execute: boolean }): Promise<RmsConfirmOrderResult>;
  close(): Promise<void>;
}

export interface RmsBrowserClientDeps {
  config: RmsBrowserConfig;
  // テスト用にPageを注入可能にする。省略時はPersistent Contextを起動/再利用する。
  getPage?: () => Promise<Page>;
}

export function createRmsBrowserClient(deps: RmsBrowserClientDeps): RmsBrowserClient {
  const { config, getPage } = deps;

  async function resolvePage(): Promise<Page> {
    if (getPage) return getPage();

    const context = await getRmsBrowserContext(config);
    const pages = context.pages();
    return pages[pages.length - 1] ?? (await context.newPage());
  }

  async function checkLoginState(): Promise<RmsLoginState> {
    const page = await resolvePage();
    await page.goto(config.mainMenuUrl, { waitUntil: "networkidle" });

    const needsLoginCount = await mainMenuSelectors.reloginRequiredHeading(page).count();
    return needsLoginCount > 0 ? "needs_login" : "logged_in";
  }

  async function verifyPendingConfirmationScreen(): Promise<RmsPendingConfirmationScreenCheck> {
    const page = await resolvePage();
    await page.goto(config.orderListPendingConfirmationUrl, { waitUntil: "networkidle" });

    const tabVisible = (await orderListSelectors.pendingConfirmationTab(page).count()) > 0;
    const bulkMenuVisible = (await orderListSelectors.bulkActionMenuButton(page).count()) > 0;

    return { tabVisible, bulkMenuVisible };
  }

  async function confirmOrder(
    orderNumber: string,
    options: { execute: boolean }
  ): Promise<RmsConfirmOrderResult> {
    const page = await resolvePage();
    let screenshotPath: string | undefined;

    try {
      await page.goto(config.orderListPendingConfirmationUrl, { waitUntil: "networkidle" });

      // networkidle到達後も一覧行は非同期(クライアントサイド)描画のため、
      // 固定待機ではなくチェックボックスの出現を明示的に待つ(2026-08-06、
      // 固定1.5秒待機直後はcount()=0だが直後には存在するレースが実データで確認された)。
      const checkbox = orderListSelectors.resultRowCheckbox(page, orderNumber);
      const found = await checkbox
        .waitFor({ state: "attached", timeout: 8000 })
        .then(() => true)
        .catch(() => false);

      screenshotPath = await takeScreenshot(page, config, orderNumber, "search");

      if (!found) {
        return {
          orderNumber,
          found: false,
          executed: false,
          success: false,
          screenshotPath,
          errorMessage: "対象注文が検索結果に見つかりませんでした",
        };
      }

      if (!options.execute) {
        return {
          orderNumber,
          found: true,
          executed: false,
          success: false,
          screenshotPath,
          errorMessage: "execute=falseのためドライランとして扱い、注文確認は実行していません",
        };
      }

      await checkbox.check();
      await orderListSelectors.bulkActionMenuButton(page).click();
      await page.waitForTimeout(800);
      await bulkActionSelectors.confirmOrderButton(page).click();
      await page.waitForTimeout(500);
      await bulkActionSelectors.confirmOrderModalButton(page).click();
      await page.waitForTimeout(1500);

      screenshotPath = await takeScreenshot(page, config, orderNumber, "confirmed");

      return { orderNumber, found: true, executed: true, success: true, screenshotPath };
    } catch (error) {
      return {
        orderNumber,
        found: false,
        executed: options.execute,
        success: false,
        screenshotPath,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async function close(): Promise<void> {
    // Persistent Contextを閉じるとRMSの再ログインが必要になる可能性があるため、
    // ここでは何もしない。明示的に閉じたい場合はrms-browser-context.tsの
    // closeRmsBrowserContext()を直接呼び出すこと。
  }

  return { checkLoginState, verifyPendingConfirmationScreen, confirmOrder, close };
}

async function takeScreenshot(
  page: Page,
  config: RmsBrowserConfig,
  orderNumber: string,
  label: string
): Promise<string> {
  const screenshotDir = path.join(path.dirname(config.profileDir), "screenshots");
  const fileName = `${Date.now()}-${label}-${orderNumber}.png`;
  const screenshotPath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

// 実運用向けのデフォルトファクトリ。
export function createDefaultRmsBrowserClient(config: RmsBrowserConfig): RmsBrowserClient {
  return createRmsBrowserClient({ config });
}
