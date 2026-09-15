import axios, { type AxiosInstance, type AxiosError } from "axios";

import type { RmsConfig } from "./rms-config";
import { RmsAuthError, RmsHttpError, RmsNetworkError, RmsTimeoutError } from "./rms-errors";

// RMS商品API 2.0へのHTTP通信のみを責務とする(rms-api-client.tsの注文用と役割を分離)。
// 商品APIはGET+クエリパラメータ形式(注文APIはPOST+JSONボディ)のため、通信部分のみ別クラスにする。

export interface RmsItemApiClientDeps {
  config: RmsConfig;
  httpClient?: AxiosInstance;
}

export interface SearchItemsParams {
  hits: number;
  offset: number;
}

export class RmsItemApiClient {
  private readonly config: RmsConfig;
  private readonly http: AxiosInstance;

  constructor({ config, httpClient }: RmsItemApiClientDeps) {
    this.config = config;
    this.http =
      httpClient ??
      axios.create({
        baseURL: config.baseUrl,
        timeout: config.requestTimeoutMs,
        // rms-api-client.tsと同じ理由(文字化け対策)で生バイト列を自前デコードする。
        responseType: "arraybuffer",
        headers: {
          Authorization: config.authHeader,
        },
      });
  }

  async searchItems(params: SearchItemsParams): Promise<unknown> {
    try {
      const response = await this.http.get(this.config.itemSearchPath, {
        params: { hits: params.hits, offset: params.offset },
      });
      return decodeUtf8Json(response.data);
    } catch (error) {
      throw this.toRmsError(error);
    }
  }

  private toRmsError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.code === "ECONNABORTED") {
        return new RmsTimeoutError("RMS商品APIへのリクエストがタイムアウトしました", {
          cause: axiosError,
        });
      }

      if (axiosError.response) {
        const status = axiosError.response.status;
        const responseBody = decodeUtf8Json(axiosError.response.data);
        if (status === 401 || status === 403) {
          return new RmsAuthError("RMS商品API認証に失敗しました", status, responseBody, {
            cause: axiosError,
          });
        }
        return new RmsHttpError(
          `RMS商品APIがエラーを返しました (status=${status})`,
          status,
          responseBody,
          { cause: axiosError }
        );
      }

      return new RmsNetworkError("RMS商品APIへの接続に失敗しました", { cause: axiosError });
    }

    return error instanceof Error
      ? error
      : new RmsNetworkError("RMS商品API呼び出しで不明なエラーが発生しました");
  }
}

function decodeUtf8Json(data: unknown): unknown {
  if (data === undefined || data === null) return data;

  const text = Buffer.isBuffer(data)
    ? data.toString("utf-8")
    : Buffer.from(data as ArrayBuffer).toString("utf-8");

  if (text.length === 0) return undefined;

  return JSON.parse(text);
}
