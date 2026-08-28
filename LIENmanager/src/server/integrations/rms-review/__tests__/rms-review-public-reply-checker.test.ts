import type { Page } from "playwright";
import { describe, expect, it, vi } from "vitest";

import { checkPublicReplyStatus } from "../rms-review-public-reply-checker";

interface FakePageOptions {
  hasContainer?: boolean;
  hasHeading?: boolean;
  headerText?: string;
  bodyText?: string;
  gotoError?: Error;
  responseStatus?: number;
}

// rms-review-reply-browser-client.test.tsと同じ方針: page.locator()の呼び出し先
// (セレクタ文字列)に応じて、fixtureのロケーターを返すフェイクPageを組み立てる。
function buildFakePage(options: FakePageOptions = {}): Page {
  const headerLocator = {
    first: () => headerLocator,
    innerText: vi.fn(async () => options.headerText ?? "ショップからのコメント\n2026/08/20"),
  };
  const bodyLocator = {
    first: () => bodyLocator,
    innerText: vi.fn(async () => options.bodyText ?? "この度はご感想をありがとうございます。"),
  };
  const headingLocator = {
    count: vi.fn(async () => (options.hasHeading === false ? 0 : 1)),
  };
  const containerFirst = {
    getByText: vi.fn(() => headingLocator),
    locator: vi.fn((selector: string) => {
      if (selector.includes("comment-header--")) return headerLocator;
      if (selector.includes("shop-comment-body--")) return bodyLocator;
      throw new Error(`unexpected selector: ${selector}`);
    }),
  };
  const container = {
    count: vi.fn(async () => (options.hasContainer === false ? 0 : 1)),
    first: vi.fn(() => containerFirst),
  };

  return {
    goto: vi.fn(async () => {
      if (options.gotoError) throw options.gotoError;
      const status = options.responseStatus ?? 200;
      return { ok: () => status < 400, status: () => status };
    }),
    locator: vi.fn((selector: string) => {
      if (selector.includes('shop-comment--')) return container;
      throw new Error(`unexpected selector: ${selector}`);
    }),
  } as unknown as Page;
}

describe("checkPublicReplyStatus", () => {
  it("「ショップからのコメント」ブロックが見つかれば replied と判定し、返信日を抽出する", async () => {
    const page = buildFakePage();

    const result = await checkPublicReplyStatus(page, "https://review.rakuten.co.jp/item/1/x/");

    expect(result.judgement).toBe("replied");
    expect(result.repliedDateText).toBe("2026/08/20");
    // JST 2026/08/20 00:00 は UTC 2026/08/19 15:00
    expect(result.repliedAt?.toISOString()).toBe("2026-08-19T15:00:00.000Z");
    expect(result.replyBodyLength).toBeGreaterThan(0);
    // 既定(options未指定)では本文そのものは保持しない(個人情報方針)。
    expect(result.replyBodyText).toBeNull();
  });

  it("options.includeReplyBody=trueの場合のみ本文そのものを返す", async () => {
    const page = buildFakePage({ bodyText: "この度はご感想をありがとうございます。" });

    const withoutBody = await checkPublicReplyStatus(page, "https://review.rakuten.co.jp/item/1/x/");
    expect(withoutBody.replyBodyText).toBeNull();

    const withBody = await checkPublicReplyStatus(page, "https://review.rakuten.co.jp/item/1/x/", {
      includeReplyBody: true,
    });
    expect(withBody.replyBodyText).toBe("この度はご感想をありがとうございます。");
    expect(withBody.replyBodyLength).toBe(withBody.replyBodyText?.length);
  });

  it("shop-comment--要素自体が存在しなければ not_replied と判定する", async () => {
    const page = buildFakePage({ hasContainer: false });

    const result = await checkPublicReplyStatus(page, "https://review.rakuten.co.jp/item/1/x/");

    expect(result.judgement).toBe("not_replied");
    expect(result.repliedAt).toBeNull();
  });

  it("shop-comment--要素はあるが見出しテキストが確認できない場合は undetermined とする(安全側)", async () => {
    const page = buildFakePage({ hasHeading: false });

    const result = await checkPublicReplyStatus(page, "https://review.rakuten.co.jp/item/1/x/");

    expect(result.judgement).toBe("undetermined");
    expect(result.reason).toMatch(/見出しテキスト/);
  });

  it("ページ遷移に失敗した場合は undetermined とする", async () => {
    const page = buildFakePage({ gotoError: new Error("net::ERR_CONNECTION_RESET") });

    const result = await checkPublicReplyStatus(page, "https://review.rakuten.co.jp/item/1/x/");

    expect(result.judgement).toBe("undetermined");
    expect(result.reason).toMatch(/ページ遷移に失敗/);
  });

  it("HTTPステータスが異常な場合は undetermined とする", async () => {
    const page = buildFakePage({ responseStatus: 404 });

    const result = await checkPublicReplyStatus(page, "https://review.rakuten.co.jp/item/1/x/");

    expect(result.judgement).toBe("undetermined");
    expect(result.reason).toMatch(/404/);
  });
});
