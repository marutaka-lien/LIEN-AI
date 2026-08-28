// RMSレビュー連携専用のエラー型。clickpost-errors.ts / rms-errors.tsと同じ階層方針。

export class RmsReviewIntegrationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

// RMS_REVIEW_TOOL_URL等の環境変数が未設定・不正
export class RmsReviewConfigError extends RmsReviewIntegrationError {}

// CSVダウンロード自体が失敗した場合(ダウンロードイベントが発火しない、リンクが見つからない等)
export class RmsReviewDownloadError extends RmsReviewIntegrationError {}

// CSVのヘッダー構成が想定と異なる、行のパースに失敗した場合
export class RmsReviewParseError extends RmsReviewIntegrationError {}

// レビュー詳細ページに返信フォームが見つからない場合(セレクタ不一致・
// レビューが返信不可の状態等)
export class RmsReviewReplyFormNotFoundError extends RmsReviewIntegrationError {}

// 返信の投稿操作自体が失敗した場合(投稿ボタン押下後に完了確認が取れない等)
export class RmsReviewReplyPostError extends RmsReviewIntegrationError {}
