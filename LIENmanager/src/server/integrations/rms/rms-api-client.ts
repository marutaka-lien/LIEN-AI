import axios, { type AxiosInstance, type AxiosError } from "axios";

import type { RmsConfig } from "./rms-config";
import { RmsAuthError, RmsHttpError, RmsNetworkError, RmsTimeoutError } from "./rms-errors";

// RMS APIへのHTTP通信のみを責務とする。認証ヘッダー生成・リクエスト送信・
// HTTPエラーのドメインエラーへの変換・レスポンス受信までを行い、
// レスポンスのバリデーションやOrderへの変換は一切行わない(rms-types.ts/rms-order-mapper.tsの責務)。

export interface RmsApiClientDeps {
  config: RmsConfig;
  // テスト時にモックのAxiosInstanceを注入できるようにする。
  httpClient?: AxiosInstance;
}

export class RmsApiClient {
  private readonly config: RmsConfig;
  private readonly http: AxiosInstance;

  constructor({ config, httpClient }: RmsApiClientDeps) {
    this.config = config;
    this.http =
      httpClient ??
      axios.create({
        baseURL: config.baseUrl,
        timeout: config.requestTimeoutMs,
        // RMSのレスポンスがUTF-8であることを明示的に保証するため、生バイト列で受け取り
        // 自前でデコードする(axios/Nodeの自動判定に任せると文字化けが発生したため)。
        responseType: "arraybuffer",
        headers: {
          Authorization: config.authHeader,
          "Content-Type": "application/json; charset=utf-8",
        },
      });
  }

  async searchOrder(body: unknown): Promise<unknown> {
    return this.post(this.config.searchOrderPath, body);
  }

  async getOrder(body: unknown): Promise<unknown> {
    return this.post(this.config.getOrderPath, body);
  }

  async updateOrderShipping(body: unknown): Promise<unknown> {
    return this.post(this.config.updateOrderShippingPath, body);
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    try {
      const response = await this.http.post(path, body);
      return decodeUtf8Json(response.data);
    } catch (error) {
      throw this.toRmsError(error);
    }
  }

  private toRmsError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.code === "ECONNABORTED") {
        return new RmsTimeoutError("RMS APIへのリクエストがタイムアウトしました", {
          cause: axiosError,
        });
      }

      if (axiosError.response) {
        const status = axiosError.response.status;
        const responseBody = decodeUtf8Json(axiosError.response.data);
        if (status === 401 || status === 403) {
          return new RmsAuthError("RMS API認証に失敗しました", status, responseBody, {
            cause: axiosError,
          });
        }
        return new RmsHttpError(
          `RMS APIがエラーを返しました (status=${status})`,
          status,
          responseBody,
          { cause: axiosError }
        );
      }

      // サーバーからレスポンスを受け取れなかった(DNS失敗・接続拒否等)
      return new RmsNetworkError("RMS APIへの接続に失敗しました", { cause: axiosError });
    }

    return error instanceof Error
      ? error
      : new RmsNetworkError("RMS API呼び出しで不明なエラーが発生しました");
  }
}

// responseType: "arraybuffer" で受け取った生バイト列をUTF-8として明示的にデコードしてJSONへ変換する。
function decodeUtf8Json(data: unknown): unknown {
  if (data === undefined || data === null) return data;

  const text = Buffer.isBuffer(data)
    ? data.toString("utf-8")
    : Buffer.from(data as ArrayBuffer).toString("utf-8");

  if (text.length === 0) return undefined;

  return JSON.parse(text);
}
