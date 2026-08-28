export class ClickPostIntegrationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

// RMS_MAINMENU_URL等と同様、環境変数の不足・不正。
export class ClickPostConfigError extends ClickPostIntegrationError {}

// OrderからClickPostCsvRowへの変換に失敗した場合(郵便番号不正・住所欄超過等)。
export class ClickPostMappingError extends ClickPostIntegrationError {
  constructor(message: string, readonly orderNumber: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

// 実登録(CSVアップロード・決済・ラベル取得)は実画面の検証が完了するまで未実装。
export class ClickPostNotImplementedError extends ClickPostIntegrationError {}
