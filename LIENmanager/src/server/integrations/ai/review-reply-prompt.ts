// 楽天レビューへの返信文を生成する際のプロンプト定義。
// 店舗としてのトーン・NG事項はここに集約し、文面の調整はこのファイルの変更だけで完結させる。
//
// ★返信文のフォーマット・トーン・構成を変更する場合は、このファイル(特に
// REVIEW_REPLY_SYSTEM_PROMPT)だけを差し替えればよい。生成ロジック本体
// (review-reply-generator.ts)・保存/表示側(review.service.ts, review.repository.ts,
// review-reply-panel.tsx等)は生成結果の文字列の中身に一切依存しない作りになっているため、
// 影響範囲はこのファイルに閉じる。2026-08-25時点では正式なフォーマット要件が未確定のため、
// 下記は暫定の簡易フォーマットとして運用している(要件確定後に差し替え予定)。
export const REVIEW_REPLY_SYSTEM_PROMPT = `あなたは楽天市場に出店している店舗の担当者です。届いたレビューに対する返信文を作成してください。

# トーン・方針
- 丁寧で温かみのある日本語(敬語)で書く。
- レビュー内の具体的な指摘(商品の特徴・配送・梱包など)に触れ、テンプレート的にならないようにする。
- 評価が高い場合は感謝を伝える。
- 評価が低い場合(1〜2)は、まず謝意を示し、指摘内容を真摯に受け止める姿勢を示す。ただし過度に卑屈にはならない。
- 値引き・返金・交換など、この場で確約できない具体的な対応は約束しない。個別対応が必要な場合は「お問い合わせ窓口までご連絡ください」といった一般的な案内に留める。
- レビュアーの個人情報(氏名・住所等)には一切触れない。
- 返信文は3〜5文程度、200〜400文字程度を目安にする。
- 返信文の本文のみを出力し、前置き・見出し・署名は付けない。`;

export interface ReviewReplyPromptInput {
  reviewType: string; // "product" | "shop"
  rating: number;
  title: string | null;
  productName: string | null;
  body: string;
}

export function buildReviewReplyUserMessage(input: ReviewReplyPromptInput): string {
  const lines = [
    `種別: ${input.reviewType === "shop" ? "ショップレビュー" : "商品レビュー"}`,
    `評価: ${input.rating} / 5`,
  ];

  if (input.productName) lines.push(`商品名: ${input.productName}`);
  if (input.title) lines.push(`タイトル: ${input.title}`);

  lines.push("本文:", input.body);

  return lines.join("\n");
}
