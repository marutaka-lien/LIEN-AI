// RMS連携専用のエラー型。呼び出し側(Service/オーケストレーター)が
// instanceof で種別を判定し、リトライ可否やユーザー通知内容を出し分けられるようにする。

export class RmsIntegrationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

// RMS_SERVICE_SECRET等の環境変数が未設定・不正
export class RmsConfigError extends RmsIntegrationError {}

// 401/403等、認証情報が拒否された
export class RmsAuthError extends RmsIntegrationError {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody?: unknown,
    options?: { cause?: unknown }
  ) {
    super(message, options);
  }
}

// 認証以外のHTTPエラー(4xx/5xx)。responseBodyにはRMSが返した実際のエラー内容(あれば)を保持する。
export class RmsHttpError extends RmsIntegrationError {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody?: unknown,
    options?: { cause?: unknown }
  ) {
    super(message, options);
  }
}

// リクエストタイムアウト
export class RmsTimeoutError extends RmsIntegrationError {}

// DNS/接続失敗等、レスポンス自体を受け取れなかった場合
export class RmsNetworkError extends RmsIntegrationError {}

// レスポンスのJSONパース失敗、またはZodスキーマ検証失敗
export class RmsResponseFormatError extends RmsIntegrationError {}

// RMSのMessageModelListに含まれるビジネス上のエラー(APIは200で返すがエラー内容を含む場合)
export class RmsApiBusinessError extends RmsIntegrationError {
  constructor(message: string, readonly code?: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

// このステップでは未実装の操作(confirmOrder等)が呼ばれた場合
export class RmsNotImplementedError extends RmsIntegrationError {}
