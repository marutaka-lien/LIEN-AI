import type { Page } from "playwright";
import { describe, expect, it, vi } from "vitest";

import { RmsReviewReplyFormNotFoundError, RmsReviewReplyPostError } from "../rms-review-errors";
import { createRmsReviewReplyBrowserClient } from "../rms-review-reply-browser-client";

interface FakePageOptions {
  textareaCount?: number;
  submitButtonCount?: number;
  confirmationCount?: number;
  onClick?: (label: string) => void;
  onFill?: (text: string) => void;
}

function buildFakePage(options: FakePageOptions = {}): Page {
  function buildLocator(count: number, label: string) {
    return {
      count: vi.fn(async () => count),
      fill: vi.fn(async (text: string) => options.onFill?.(text)),
      click: vi.fn(async () => options.onClick?.(label)),
    };
  }

  return {
    goto: vi.fn(async () => {}),
    waitForTimeout: vi.fn(async () => {}),
    getByRole: vi.fn((role: string, opts: { name: string }) => {
      if (role === "textbox") return buildLocator(options.textareaCount ?? 0, "textarea");
      if (role === "button") return buildLocator(options.submitButtonCount ?? 0, `button:${opts.name}`);
      throw new Error(`unexpected role: ${role}`);
    }),
    getByText: vi.fn(() => buildLocator(options.confirmationCount ?? 0, "confirmation")),
  } as unknown as Page;
}

describe("RmsReviewReplyBrowserClient.postReply", () => {
  it("返信フォームが見つからない場合はRmsReviewReplyFormNotFoundErrorを投げる", async () => {
    const page = buildFakePage({ textareaCount: 0 });
    const client = createRmsReviewReplyBrowserClient({
      config: { reviewToolUrl: "https://review.example.invalid/" },
      getPage: async () => page,
    });

    await expect(
      client.postReply("https://review.example.invalid/detail/1", "ありがとうございます", {
        execute: false,
      })
    ).rejects.toThrow(RmsReviewReplyFormNotFoundError);
  });

  it("execute:falseの場合はテキスト入力のみ行い、投稿ボタンは押さない(ドライラン)", async () => {
    const clicks: string[] = [];
    const filled: string[] = [];
    const page = buildFakePage({
      textareaCount: 1,
      onClick: (label) => clicks.push(label),
      onFill: (text) => filled.push(text),
    });
    const client = createRmsReviewReplyBrowserClient({
      config: { reviewToolUrl: "https://review.example.invalid/" },
      getPage: async () => page,
    });

    const result = await client.postReply(
      "https://review.example.invalid/detail/1",
      "ありがとうございます",
      { execute: false }
    );

    expect(result).toEqual({ formFound: true, posted: false });
    expect(filled).toEqual(["ありがとうございます"]);
    expect(clicks).toEqual([]);
  });

  it("execute:trueかつ投稿完了が確認できた場合はposted:trueを返す", async () => {
    const clicks: string[] = [];
    const page = buildFakePage({
      textareaCount: 1,
      submitButtonCount: 1,
      confirmationCount: 1,
      onClick: (label) => clicks.push(label),
    });
    const client = createRmsReviewReplyBrowserClient({
      config: { reviewToolUrl: "https://review.example.invalid/" },
      getPage: async () => page,
    });

    const result = await client.postReply(
      "https://review.example.invalid/detail/1",
      "ありがとうございます",
      { execute: true }
    );

    expect(result).toEqual({ formFound: true, posted: true });
    expect(clicks).toEqual(["button:投稿する"]);
  });

  it("execute:trueで投稿完了を確認できない場合はRmsReviewReplyPostErrorを投げる", async () => {
    const page = buildFakePage({ textareaCount: 1, submitButtonCount: 1, confirmationCount: 0 });
    const client = createRmsReviewReplyBrowserClient({
      config: { reviewToolUrl: "https://review.example.invalid/" },
      getPage: async () => page,
    });

    await expect(
      client.postReply("https://review.example.invalid/detail/1", "ありがとうございます", {
        execute: true,
      })
    ).rejects.toThrow(RmsReviewReplyPostError);
  });
});
