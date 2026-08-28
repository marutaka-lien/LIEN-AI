import Anthropic from "@anthropic-ai/sdk";

import { AiGenerationError } from "./ai-errors";
import { loadAiConfig, type AiConfig } from "./ai-config";
import {
  REVIEW_REPLY_SYSTEM_PROMPT,
  buildReviewReplyUserMessage,
  type ReviewReplyPromptInput,
} from "./review-reply-prompt";

export interface ReviewReplyGenerator {
  generateReplyText(input: ReviewReplyPromptInput): Promise<string>;
}

export interface ReviewReplyGeneratorDeps {
  config: AiConfig;
  // テスト用にAnthropicクライアントを注入可能にする(実APIを叩かない)。
  client?: Pick<Anthropic, "messages">;
}

export function createReviewReplyGenerator(deps: ReviewReplyGeneratorDeps): ReviewReplyGenerator {
  const { config } = deps;
  const client = deps.client ?? new Anthropic({ apiKey: config.apiKey });

  async function generateReplyText(input: ReviewReplyPromptInput): Promise<string> {
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: config.model,
        max_tokens: 600,
        system: REVIEW_REPLY_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildReviewReplyUserMessage(input) }],
      });
    } catch (error) {
      throw new AiGenerationError(
        `返信文の生成に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    const text = textBlock?.text.trim();

    if (!text) {
      throw new AiGenerationError("AIから返信文のテキストを取得できませんでした");
    }

    return text;
  }

  return { generateReplyText };
}

// 実運用向けのデフォルトファクトリ。
export function createDefaultReviewReplyGenerator(): ReviewReplyGenerator {
  return createReviewReplyGenerator({ config: loadAiConfig() });
}
