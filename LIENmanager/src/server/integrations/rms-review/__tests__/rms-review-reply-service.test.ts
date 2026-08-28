import { describe, expect, it, vi } from "vitest";

import { createRmsReviewReplyService } from "../rms-review-reply-service";
import type { RmsReviewReplyBrowserClient } from "../rms-review-reply-browser-client";

describe("RmsReviewReplyService.postReply", () => {
  it("browserClient.postReplyへそのまま委譲し、posted結果を返す", async () => {
    const browserClient: RmsReviewReplyBrowserClient = {
      postReply: vi.fn(async () => ({ formFound: true, posted: true })),
    };
    const service = createRmsReviewReplyService({ browserClient });

    const result = await service.postReply("https://review.example.invalid/detail/1", "ありがとうございます", {
      execute: true,
    });

    expect(result).toEqual({ posted: true });
    expect(browserClient.postReply).toHaveBeenCalledWith(
      "https://review.example.invalid/detail/1",
      "ありがとうございます",
      { execute: true }
    );
  });
});
