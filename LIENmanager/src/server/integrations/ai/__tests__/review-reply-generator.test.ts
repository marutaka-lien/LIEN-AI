import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";

import { AiGenerationError } from "../ai-errors";
import { createReviewReplyGenerator } from "../review-reply-generator";
import type { ReviewReplyPromptInput } from "../review-reply-prompt";

function buildInput(overrides: Partial<ReviewReplyPromptInput> = {}): ReviewReplyPromptInput {
  return {
    reviewType: "product",
    rating: 5,
    title: "とても良い",
    productName: "テスト商品",
    body: "梱包も丁寧で満足しています",
    ...overrides,
  };
}

function buildFakeClient(
  createImpl: (...args: unknown[]) => Promise<Anthropic.Message>
): Pick<Anthropic, "messages"> {
  return {
    messages: { create: vi.fn(createImpl) } as unknown as Anthropic["messages"],
  };
}

function textMessage(text: string): Anthropic.Message {
  return {
    content: [{ type: "text", text, citations: [] }],
  } as unknown as Anthropic.Message;
}

describe("reviewReplyGenerator.generateReplyText", () => {
  it("Anthropicのレスポンスからテキストブロックを取り出して返す", async () => {
    const client = buildFakeClient(async () =>
      textMessage("この度はご購入いただきありがとうございます。")
    );
    const generator = createReviewReplyGenerator({
      config: { apiKey: "test-key", model: "claude-haiku-4-5-20251001" },
      client,
    });

    const reply = await generator.generateReplyText(buildInput());

    expect(reply).toBe("この度はご購入いただきありがとうございます。");
    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-haiku-4-5-20251001" })
    );
  });

  it("Anthropic呼び出しが失敗した場合はAiGenerationErrorを投げる", async () => {
    const client = buildFakeClient(async () => {
      throw new Error("rate limited");
    });
    const generator = createReviewReplyGenerator({
      config: { apiKey: "test-key", model: "claude-haiku-4-5-20251001" },
      client,
    });

    await expect(generator.generateReplyText(buildInput())).rejects.toThrow(AiGenerationError);
  });

  it("テキストブロックが空の場合はAiGenerationErrorを投げる", async () => {
    const client = buildFakeClient(async () => textMessage("   "));
    const generator = createReviewReplyGenerator({
      config: { apiKey: "test-key", model: "claude-haiku-4-5-20251001" },
      client,
    });

    await expect(generator.generateReplyText(buildInput())).rejects.toThrow(AiGenerationError);
  });
});
