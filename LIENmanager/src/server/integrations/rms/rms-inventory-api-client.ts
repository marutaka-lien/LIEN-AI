import axios, { type AxiosInstance, type AxiosError } from "axios";

import type { RmsConfig } from "./rms-config";
import { RmsAuthError, RmsHttpError, RmsNetworkError, RmsTimeoutError } from "./rms-errors";
import type { RmsInventoryKey } from "./rms-inventory-types";

// RMS在庫API 2.0(inventories.bulk-get)へのHTTP通信のみを責務とする。
// POST + {inventories:[{manageNumber,variantId}]}形式(rms-api-client.tsの注文用と同じPOSTパターン)。

export interface RmsInventoryApiClientDeps {
  config: RmsConfig;
  httpClient?: AxiosInstance;
}

export class RmsInventoryApiClient {
  private readonly config: RmsConfig;
  private readonly http: AxiosInstance;

  constructor({ config, httpClient }: RmsInventoryApiClientDeps) {
    this.config = config;
    this.http =
      httpClient ??
      axios.create({
        baseURL: config.baseUrl,
        timeout: config.requestTimeoutMs,
        responseType: "arraybuffer",
        headers: {
          Authorization: config.authHeader,
          "Content-Type": "application/json; charset=utf-8",
        },
      });
  }

  async bulkGetInventories(keys: RmsInventoryKey[]): Promise<unknown> {
    try {
      const response = await this.http.post(this.config.inventoryBulkGetPath, {
        inventories: keys,
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
        return new RmsTimeoutError("RMS在庫APIへのリクエストがタイムアウトしました", {
          cause: axiosError,
        });
      }

      if (axiosError.response) {
        const status = axiosError.response.status;
        const responseBody = decodeUtf8Json(axiosError.response.data);
        if (status === 401 || status === 403) {
          return new RmsAuthError("RMS在庫API認証に失敗しました", status, responseBody, {
            cause: axiosError,
          });
        }
        return new RmsHttpError(
          `RMS在庫APIがエラーを返しました (status=${status})`,
          status,
          responseBody,
          { cause: axiosError }
        );
      }

      return new RmsNetworkError("RMS在庫APIへの接続に失敗しました", { cause: axiosError });
    }

    return error instanceof Error
      ? error
      : new RmsNetworkError("RMS在庫API呼び出しで不明なエラーが発生しました");
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
