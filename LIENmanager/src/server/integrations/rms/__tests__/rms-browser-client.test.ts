import type { Page } from "playwright";
import { describe, expect, it, vi } from "vitest";

import type { RmsBrowserConfig } from "../rms-browser-config";
import { createRmsBrowserClient } from "../rms-browser-client";

function buildBrowserConfig(): RmsBrowserConfig {
  return {
    mainMenuUrl: "https://mainmenu.example.invalid/rms",
    orderSearchUrl: "https://order.example.invalid/search",
    orderDetailUrlTemplate: "https://order.example.invalid/detail?orderNumber={orderNumber}",
    orderListPendingConfirmationUrl: "https://order.example.invalid/list?ORDER_PROGRESS=100",
    profileDir: "C:\\fake\\profile",
  };
}

interface FakePageOptions {
  textCounts?: Record<string, number>;
  onClick?: (label: string) => void;
}

function buildFakePage(options: FakePageOptions = {}): Page {
  const textCounts = options.textCounts ?? {};

  function buildLocator(label: string) {
    return {
      count: vi.fn(async () => textCounts[label] ?? 0),
      fill: vi.fn(async () => {}),
      click: vi.fn(async () => options.onClick?.(label)),
      check: vi.fn(async () => options.onClick?.(`check:${label}`)),
    };
  }

  return {
    goto: vi.fn(async () => {}),
    waitForTimeout: vi.fn(async () => {}),
    screenshot: vi.fn(async () => Buffer.from("")),
    getByText: vi.fn((text: string) => buildLocator(`text:${text}`)),
    getByPlaceholder: vi.fn((text: string) => buildLocator(`placeholder:${text}`)),
    getByRole: vi.fn((_role: string, opts?: { name?: string }) =>
      buildLocator(`role:${opts?.name ?? ""}`)
    ),
    locator: vi.fn((selector: string) => buildLocator(`selector:${selector}`)),
  } as unknown as Page;
}

describe("RmsBrowserClient.checkLoginState", () => {
  it("再ログイン誘導テキストが存在する場合はneeds_loginを返す", async () => {
    const page = buildFakePage({
      textCounts: { "text:再度ログインをお願いいたします": 1 },
    });
    const client = createRmsBrowserClient({ config: buildBrowserConfig(), getPage: async () => page });

    await expect(client.checkLoginState()).resolves.toBe("needs_login");
  });

  it("再ログイン誘導テキストが存在しない場合はlogged_inを返す", async () => {
    const page = buildFakePage({ textCounts: {} });
    const client = createRmsBrowserClient({ config: buildBrowserConfig(), getPage: async () => page });

    await expect(client.checkLoginState()).resolves.toBe("logged_in");
  });
});

describe("RmsBrowserClient.verifyPendingConfirmationScreen", () => {
  it("タブと一括処理メニューの有無を返す(0件でも画面構造は認識できる)", async () => {
    const page = buildFakePage({
      textCounts: {
        "text:注文確認待ち": 1,
        "text:一括処理": 1,
      },
    });
    const client = createRmsBrowserClient({ config: buildBrowserConfig(), getPage: async () => page });

    const result = await client.verifyPendingConfirmationScreen();

    expect(result).toEqual({ tabVisible: true, bulkMenuVisible: true });
  });
});

describe("RmsBrowserClient.confirmOrder", () => {
  it("対象注文が見つからない場合はfound:falseを返しクリックしない", async () => {
    const clicks: string[] = [];
    const page = buildFakePage({
      textCounts: {}, // resultRowCheckboxは selector:# なのでcountは0のまま
      onClick: (label) => clicks.push(label),
    });
    const client = createRmsBrowserClient({ config: buildBrowserConfig(), getPage: async () => page });

    const result = await client.confirmOrder("order-1", { execute: true });

    expect(result.found).toBe(false);
    expect(result.executed).toBe(false);
    // 対象が見つからない場合はクリック自体が発生しない。
    expect(clicks).toEqual([]);
  });

  it("execute:falseの場合、対象が見つかってもクリックしない(ドライラン)", async () => {
    const clicks: string[] = [];
    const page = buildFakePage({
      textCounts: {
        "selector:#rms-checkbox-order-column-checkbox-order-1": 1,
      },
      onClick: (label) => clicks.push(label),
    });
    const client = createRmsBrowserClient({ config: buildBrowserConfig(), getPage: async () => page });

    const result = await client.confirmOrder("order-1", { execute: false });

    expect(result.found).toBe(true);
    expect(result.executed).toBe(false);
    expect(result.errorMessage).toMatch(/ドライラン/);
    // 対象は見つかるが、execute:falseのためクリックは発生しない。
    expect(clicks).toEqual([]);
  });

  it("execute:trueかつ対象が見つかった場合は一括処理→注文確認の順でクリックする", async () => {
    const clicks: string[] = [];
    const page = buildFakePage({
      textCounts: {
        "selector:#rms-checkbox-order-column-checkbox-order-1": 1,
      },
      onClick: (label) => clicks.push(label),
    });
    const client = createRmsBrowserClient({ config: buildBrowserConfig(), getPage: async () => page });

    const result = await client.confirmOrder("order-1", { execute: true });

    expect(result.executed).toBe(true);
    expect(result.success).toBe(true);
    expect(clicks).toEqual([
      "check:selector:#rms-checkbox-order-column-checkbox-order-1",
      "text:一括処理",
      "selector:#rms-content-order-filter-final-order-btn",
      "selector:#orderConfirm",
    ]);
  });
});
