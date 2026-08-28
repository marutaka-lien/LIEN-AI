import { z } from "zod";

import { AiConfigError } from "./ai-errors";

// コスト効率を優先し、短文の返信文生成にはHaiku系をデフォルトとする。
// 文面の品質を優先したい場合はANTHROPIC_MODELで上位モデルに切り替える。
const AiEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),
});

export interface AiConfig {
  apiKey: string;
  model: string;
}

export function loadAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  const parsed = AiEnvSchema.safeParse(env);

  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new AiConfigError(`AI連携の設定が不足または不正です: ${missing}`);
  }

  return { apiKey: parsed.data.ANTHROPIC_API_KEY, model: parsed.data.ANTHROPIC_MODEL };
}
