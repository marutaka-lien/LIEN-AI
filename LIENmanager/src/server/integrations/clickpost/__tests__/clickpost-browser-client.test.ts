import type { Page } from "playwright";
import { describe, expect, it, vi } from "vitest";

import type { ClickPostBrowserConfig } from "../clickpost-config";
import { createClickPostBrowserClient } from "../clickpost-browser-client";

function buildBrowserConfig(): ClickPostBrowserConfig {
  return {
    topUrl: "https://clickpost.example.invalid/",
    mypageUrl: "https://clickpost.example.invalid/mypage/index",
    profileDir: "C:\\fake\\clickpost-profile",
  };
}

interface FakePageOptions {
  textCounts?: Record<string, number>;
  title?: string;
  onClick?: (label: string) => void;
  evaluateResult?: unknown;
}

function buildFakePage(options: FakePageOptions = {}): Page {
  const textCounts = options.textCounts ?? {};

  function buildLocator(label: string) {
    const locator = {
      count: vi.fn(async () => textCounts[label] ?? 0),
      click: vi.fn(async () => options.onClick?.(label)),
      setInputFiles: vi.fn(async () => options.onClick?.(`setInputFiles:${label}`)),
      first: vi.fn(() => locator),
    };
    return locator;
  }

  return {
    goto: vi.fn(async () => {}),
    waitForTimeout: vi.fn(async () => {}),
    title: vi.fn(async () => options.title ?? ""),
    getByText: vi.fn((text: string) => buildLocator(`text:${text}`)),
    locator: vi.fn((selector: string) => buildLocator(`selector:${selector}`)),
    evaluate: vi.fn(async () => options.evaluateResult ?? []),
  } as unknown as Page;
}

describe("ClickPostBrowserClient.checkLoginState", () => {
  it("「ログアウト」リンクが存在する場合はlogged_inを返す", async () => {
    const page = buildFakePage({ textCounts: { "text:ログアウト": 1 } });
    const client = createClickPostBrowserClient({ config: buildBrowserConfig(), getPage: async () => page });

    await expect(client.checkLoginState()).resolves.toBe("logged_in");
  });

  it("「ログアウト」リンクが存在しない場合はneeds_loginを返す", async () => {
    const page = buildFakePage({ textCounts: {} });
    const client = createClickPostBrowserClient({ config: buildBrowserConfig(), getPage: async () => page });

    await expect(client.checkLoginState()).resolves.toBe("needs_login");
  });
});

describe("ClickPostBrowserClient.navigateToBulkApplication", () => {
  it("マイページの「まとめ申込」リンクをクリックする", async () => {
    const clicks: string[] = [];
    const page = buildFakePage({ onClick: (label) => clicks.push(label) });
    const client = createClickPostBrowserClient({ config: buildBrowserConfig(), getPage: async () => page });

    await client.navigateToBulkApplication();

    expect(clicks).toEqual(["text:まとめ申込"]);
  });
});

describe("ClickPostBrowserClient.uploadCsv", () => {
  it("確認画面に到達し、エラー表示がない場合はhasValidationError:falseを返す", async () => {
    const page = buildFakePage({
      title: "まとめ申込 内容の確認 ー クリックポスト",
      textCounts: {},
    });
    const client = createClickPostBrowserClient({ config: buildBrowserConfig(), getPage: async () => page });

    const result = await client.uploadCsv("C:\\fake\\test.csv");

    expect(result).toEqual({ reachedConfirmationScreen: true, hasValidationError: false });
  });

  it("確認画面でバリデーションエラーが表示された場合はhasValidationError:trueを返す", async () => {
    const page = buildFakePage({
      title: "まとめ申込 内容の確認 ー クリックポスト",
      textCounts: { "selector:.flash_error_message": 1 },
    });
    const client = createClickPostBrowserClient({ config: buildBrowserConfig(), getPage: async () => page });

    const result = await client.uploadCsv("C:\\fake\\test.csv");

    expect(result).toEqual({ reachedConfirmationScreen: true, hasValidationError: true });
  });

  it("確認画面に到達しなかった場合はreachedConfirmationScreen:falseを返す", async () => {
    const page = buildFakePage({ title: "まとめ申込 ー クリックポスト" });
    const client = createClickPostBrowserClient({ config: buildBrowserConfig(), getPage: async () => page });

    const result = await client.uploadCsv("C:\\fake\\test.csv");

    expect(result.reachedConfirmationScreen).toBe(false);
  });
});

describe("ClickPostBrowserClient.proceedToPaymentScreen", () => {
  it("支払手続き画面に到達し、決済ボタンが存在する場合はその旨を返す", async () => {
    const page = buildFakePage({
      title: "まとめ申込 支払手続き ー クリックポスト",
      textCounts: { 'selector:input.ywallet_button[type="submit"]': 1 },
    });
    const client = createClickPostBrowserClient({ config: buildBrowserConfig(), getPage: async () => page });

    const result = await client.proceedToPaymentScreen();

    expect(result).toEqual({ reachedPaymentScreen: true, paymentButtonPresent: true });
  });

  it("支払手続き画面に到達しなかった場合はreachedPaymentScreen:falseを返す", async () => {
    const page = buildFakePage({ title: "まとめ申込 内容の確認 ー クリックポスト" });
    const client = createClickPostBrowserClient({ config: buildBrowserConfig(), getPage: async () => page });

    const result = await client.proceedToPaymentScreen();

    expect(result.reachedPaymentScreen).toBe(false);
  });
});

describe("ClickPostBrowserClient.executePayment", () => {
  it("execute:falseでもtrueでも常にClickPostNotImplementedErrorを投げる(決済未実装)", async () => {
    const page = buildFakePage();
    const client = createClickPostBrowserClient({ config: buildBrowserConfig(), getPage: async () => page });

    await expect(client.executePayment({ execute: false })).rejects.toThrow("未実装");
    await expect(client.executePayment({ execute: true })).rejects.toThrow("未実装");
  });
});

describe("ClickPostBrowserClient.fetchTrackingNumbers", () => {
  it("氏名リストをpage.evaluateへ渡し、その戻り値をそのまま返す(氏名+追跡番号のペアのみ)", async () => {
    const expected = [
      { recipientName: "テスト太郎", trackingNumber: "628000000001" },
      { recipientName: "テスト花子", trackingNumber: null },
    ];
    const page = buildFakePage({ evaluateResult: expected });
    const client = createClickPostBrowserClient({ config: buildBrowserConfig(), getPage: async () => page });

    const result = await client.fetchTrackingNumbers(["テスト太郎", "テスト花子"]);

    expect(result).toEqual(expected);
    expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), ["テスト太郎", "テスト花子"]);
  });
});
