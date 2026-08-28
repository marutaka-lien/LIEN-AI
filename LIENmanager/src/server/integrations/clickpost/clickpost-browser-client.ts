import type { Page } from "playwright";

import type { ClickPostBrowserConfig } from "./clickpost-config";
import { getClickPostBrowserContext } from "./clickpost-browser-context";
import { ClickPostNotImplementedError } from "./clickpost-errors";
import { bulkApplicationSelectors, mypageSelectors, paymentSelectors } from "./selectors";

// RmsBrowserClientと同じ責務分離: ClickPostのブラウザ操作のみを担当し、
// Order/AutomationJobについては一切関知しない。Orchestrator/ClickPostServiceは
// このクライアントのメソッドのみを呼び出し、Playwrightやセレクタの詳細を意識しない。
//
// 2026-07-23実画面調査で判明した重要な事実:
// - ClickPostにはメール/パスワード形式の独自ログイン画面が存在しない
//   (Yahoo! JAPAN ID / AmazonアカウントによるOAuthログインのみ)。
//   そのためこのクライアントは「ログイン実行」を提供しない。ログインは
//   ユーザーが表示されたブラウザで手動で行う運用とする(自動入力は行わない)。
// - まとめ申込画面(/labels/multiple_upload)へは直接URLナビゲーションでは到達できず、
//   マイページの「まとめ申込」リンクをクリックする必要がある(直接遷移は
//   /mypage/indexへリダイレクトされることを実測で確認済み)。
// - 送信ボタンは<button>ではなく<input type="submit">(次へ)。この「次へ」ボタンは
//   まとめ申込画面(アップロード)・確認画面(登録)の両方で同じセレクタ・役割で存在する。
// - CSVの「内容品」欄の文字数上限は公式CSV作成マニュアル(create_csv_manual_yahoo.pdf、
//   まとめ申込画面からリンクされている公式ヘルプ)で全角15文字/半角30文字以内と確認済み
//   (clickpost-types.tsのCLICKPOST_CONTENTS_MAX_LENGTHに反映済み)。
// - 確認画面で「次へ」をクリックすると支払手続き画面(/labels/multiple_payment)へ遷移する。
//   決済ボタン(Yahoo!ウォレット、class「ywallet_button」)の存在は確認済みだが、
//   クリック後にYahoo! JAPANの再認証画面へ遷移することを実際の決済で確認した
//   (2026-07-27、ユーザーの明示的許可のもとで1件実施)。この画面はユーザー自身が
//   手動で完了する運用とし(パスワード等の自動入力は行わない)、以降の決済実行自体は
//   実装しない方針に確定した(業務上、GoQSystemという別ツールで一括決済を行うため。
//   詳細はwebapp-shipping-automationのプロジェクトメモを参照)。
// - マイページの発送履歴テーブルの列構成を実画面で確認済み(2026-07-27):
//   0:申込日時 / 1:お問い合わせ番号(追跡番号、12桁数字) / 2:お届け先氏名 / 3:内容品 / ...
//   決済(GoQSystem等、自社アプリの外)が完了した後、この列から追跡番号を取得する。

export type ClickPostLoginState = "logged_in" | "needs_login";

export interface ClickPostUploadCsvResult {
  // アップロード後、確認画面(title変化)まで到達できたか。
  reachedConfirmationScreen: boolean;
  // 確認画面上にバリデーションエラー表示があったか(内容は取得しない)。
  hasValidationError: boolean;
}

export interface ClickPostProceedToPaymentResult {
  // 支払手続き画面(title変化)まで到達できたか。
  reachedPaymentScreen: boolean;
  // 決済ボタンの存在(クリックはしない)。
  paymentButtonPresent: boolean;
}

export interface ClickPostTrackingLookupResult {
  recipientName: string;
  // 発送履歴テーブルに一致する行が見つからない、または追跡番号が未発行の場合はnull。
  trackingNumber: string | null;
}

export interface ClickPostBrowserClient {
  checkLoginState(): Promise<ClickPostLoginState>;
  // マイページの「まとめ申込」リンクをクリックし、まとめ申込画面まで遷移する。
  navigateToBulkApplication(): Promise<void>;
  // CSVファイル(1件～)をアップロードし「次へ」まで進める。決済ボタンはクリックしない。
  uploadCsv(csvFilePath: string): Promise<ClickPostUploadCsvResult>;
  // 確認画面の「次へ」をクリックし、支払手続き画面まで進める。決済ボタンはクリックしない。
  proceedToPaymentScreen(): Promise<ClickPostProceedToPaymentResult>;
  // 決済実行。execute:trueが明示されない限り常に例外を投げる
  // (決済はGoQSystem側で行う運用に確定したため、このメソッドは実装しない)。
  executePayment(options: { execute: boolean }): Promise<never>;
  // マイページ発送履歴テーブルを、お届け先氏名で突き合わせて追跡番号を取得する。
  // 氏名との突合はブラウザ内(evaluate)で行い、行全体のテキストや住所等は
  // Node側へ一切持ち帰らない(氏名+追跡番号のペアのみを返す)。
  fetchTrackingNumbers(recipientNames: string[]): Promise<ClickPostTrackingLookupResult[]>;
}

export interface ClickPostBrowserClientDeps {
  config: ClickPostBrowserConfig;
  // テスト用にPageを注入可能にする。省略時はPersistent Contextを起動/再利用する。
  getPage?: () => Promise<Page>;
}

export function createClickPostBrowserClient(deps: ClickPostBrowserClientDeps): ClickPostBrowserClient {
  const { config, getPage } = deps;

  async function resolvePage(): Promise<Page> {
    if (getPage) return getPage();

    const context = await getClickPostBrowserContext(config);
    const pages = context.pages();
    return pages[pages.length - 1] ?? (await context.newPage());
  }

  async function checkLoginState(): Promise<ClickPostLoginState> {
    const page = await resolvePage();
    await page.goto(config.mypageUrl, { waitUntil: "domcontentloaded" });

    const logoutCount = await mypageSelectors.logoutLink(page).count();
    return logoutCount > 0 ? "logged_in" : "needs_login";
  }

  async function navigateToBulkApplication(): Promise<void> {
    const page = await resolvePage();
    await page.goto(config.mypageUrl, { waitUntil: "domcontentloaded" });
    await mypageSelectors.bulkApplicationLink(page).click();
    await page.waitForTimeout(1200);
  }

  async function uploadCsv(csvFilePath: string): Promise<ClickPostUploadCsvResult> {
    const page = await resolvePage();

    await bulkApplicationSelectors.csvFileInput(page).setInputFiles(csvFilePath);
    await bulkApplicationSelectors.nextButton(page).click();
    await page.waitForTimeout(2000);

    const title = await page.title();
    const reachedConfirmationScreen = title.includes("内容の確認");
    const hasValidationError = (await bulkApplicationSelectors.confirmationErrorBanner(page).count()) > 0;

    return { reachedConfirmationScreen, hasValidationError };
  }

  async function proceedToPaymentScreen(): Promise<ClickPostProceedToPaymentResult> {
    const page = await resolvePage();

    await bulkApplicationSelectors.nextButton(page).click();
    await page.waitForTimeout(2000);

    const title = await page.title();
    const reachedPaymentScreen = title.includes("支払手続き");
    const paymentButtonPresent = (await paymentSelectors.payButton(page).count()) > 0;

    return { reachedPaymentScreen, paymentButtonPresent };
  }

  async function executePayment(options: { execute: boolean }): Promise<never> {
    throw new ClickPostNotImplementedError(
      `ClickPostの決済実行は未実装です(execute=${options.execute})。決済はGoQSystem側で` +
        "一括実行する業務フローに確定したため、このクライアントでは実装しない。"
    );
  }

  async function fetchTrackingNumbers(
    recipientNames: string[]
  ): Promise<ClickPostTrackingLookupResult[]> {
    const page = await resolvePage();
    await page.goto(config.mypageUrl, { waitUntil: "domcontentloaded" });

    return page.evaluate((names: string[]) => {
      const rows = Array.from(document.querySelectorAll("table tbody tr"));
      return names.map((name) => {
        const row = rows.find((tr) => {
          const cells = tr.querySelectorAll("td");
          return cells[2]?.textContent?.trim() === name;
        });
        if (!row) return { recipientName: name, trackingNumber: null };

        const trackingCellText = row.querySelectorAll("td")[1]?.textContent?.trim() ?? "";
        const trackingNumber = /^\d{12}$/.test(trackingCellText) ? trackingCellText : null;
        return { recipientName: name, trackingNumber };
      });
    }, recipientNames);
  }

  return {
    checkLoginState,
    navigateToBulkApplication,
    uploadCsv,
    proceedToPaymentScreen,
    executePayment,
    fetchTrackingNumbers,
  };
}

// 実運用向けのデフォルトファクトリ。
export function createDefaultClickPostBrowserClient(config: ClickPostBrowserConfig): ClickPostBrowserClient {
  return createClickPostBrowserClient({ config });
}
