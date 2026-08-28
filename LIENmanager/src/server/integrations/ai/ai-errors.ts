// AI連携専用のエラー型。rms-review-errors.ts / clickpost-errors.tsと同じ階層方針。

export class AiIntegrationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

// ANTHROPIC_API_KEY等の環境変数が未設定・不正
export class AiConfigError extends AiIntegrationError {}

// Anthropic APIの呼び出し自体が失敗した場合(レート制限、タイムアウト、レスポンス形式不正等)
export class AiGenerationError extends AiIntegrationError {}
