import { z } from "zod";

import { RmsResponseFormatError } from "./rms-errors";

// RMS在庫API 2.0(inventories.bulk-get)固有の型。実APIへの疎通確認(2026-09-15)で
// リクエスト形式 {inventories:[{manageNumber,variantId}]}・レスポンス形式を確認済み。

export interface RmsInventoryKey {
  manageNumber: string;
  variantId: string;
}

const RmsInventoryEntrySchema = z
  .object({
    manageNumber: z.string(),
    variantId: z.string(),
    quantity: z.number(),
  })
  .loose();

const RmsInventoryBulkGetResponseSchema = z
  .object({
    inventories: z.array(z.unknown()).optional().default([]),
  })
  .loose();

export type RmsInventoryEntry = z.infer<typeof RmsInventoryEntrySchema>;

// manageNumberとvariantIdの組でユニークなキーを作る(Mapのキーに使う)。
export function inventoryKey(manageNumber: string, variantId: string): string {
  return `${manageNumber}::${variantId}`;
}

export function parseInventoryBulkGetResponse(raw: unknown): Map<string, number> {
  const parsed = RmsInventoryBulkGetResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new RmsResponseFormatError(
      `RMS在庫一括取得レスポンスの形式が不正です: ${parsed.error.message}`
    );
  }

  const map = new Map<string, number>();
  for (const entry of parsed.data.inventories) {
    const entryParsed = RmsInventoryEntrySchema.safeParse(entry);
    if (!entryParsed.success) continue;
    map.set(inventoryKey(entryParsed.data.manageNumber, entryParsed.data.variantId), entryParsed.data.quantity);
  }
  return map;
}
