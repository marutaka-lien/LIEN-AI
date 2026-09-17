import { z } from "zod";

import { RmsResponseFormatError } from "./rms-errors";

// RMS商品API 2.0 (items.search) 固有のレスポンス型。アプリ内部のProduct型とは分離し、
// この境界(rms-item-mapper.ts)の外にRMS固有のフィールド名を漏らさない。
// 2026-09-15 実APIへの疎通確認(GET /es/2.0/items/search)で確認済みの形。
// 公式ドキュメントはRMSアカウントが必要なため、実レスポンスの実物を根拠とする。

const RmsItemImageSchema = z
  .object({
    type: z.string().optional(),
    location: z.string().optional(),
    alt: z.string().optional(),
  })
  .loose();

const RmsItemAttributeSchema = z
  .object({
    name: z.string(),
    unit: z.string().optional(),
    values: z.array(z.string()).optional().default([]),
  })
  .loose();

const RmsItemVariantSchema = z
  .object({
    selectorValues: z.record(z.string(), z.string()).optional(),
    standardPrice: z.union([z.string(), z.number()]).optional(),
    hidden: z.boolean().optional(),
    attributes: z.array(RmsItemAttributeSchema).optional().default([]),
  })
  .loose();

const RmsItemVariantSelectorSchema = z
  .object({
    key: z.string().optional(),
    displayName: z.string().optional(),
    values: z
      .array(z.object({ displayValue: z.string().optional() }).loose())
      .optional()
      .default([]),
  })
  .loose();

const RmsItemModelSchema = z
  .object({
    manageNumber: z.string(),
    itemNumber: z.string().optional(),
    itemType: z.string().optional(),
    title: z.string().optional(),
    tagline: z.string().nullable().optional(),
    images: z.array(RmsItemImageSchema).optional().default([]),
    genreId: z.union([z.string(), z.number()]).optional(),
    hideItem: z.boolean().optional(),
    variantSelectors: z.array(RmsItemVariantSelectorSchema).optional().default([]),
    // variantsはRMSがオブジェクト(キー=バリアントID)で返す(配列ではない)。
    variants: z.record(z.string(), RmsItemVariantSchema).optional().default({}),
    updated: z.string().optional(),
    created: z.string().optional(),
  })
  .loose();

// resultsの要素は個別に安全パースする(1件の形式不正で全体を失敗させないため)。
// そのためこの時点ではitemの中身までは検証しない。
const RmsItemSearchResponseSchema = z
  .object({
    offset: z.number().optional(),
    numFound: z.number().optional().default(0),
    results: z.array(z.unknown()).optional().default([]),
  })
  .loose();

export type RmsItemModel = z.infer<typeof RmsItemModelSchema>;
export type RmsItemVariant = z.infer<typeof RmsItemVariantSchema>;

export interface RmsItemSearchParseResult {
  numFound: number;
  items: RmsItemModel[];
  // 個別の要素がスキーマに合わず読み飛ばした件数(全体は失敗させない)。
  skippedCount: number;
}

export function parseItemSearchResponse(raw: unknown): RmsItemSearchParseResult {
  const parsed = RmsItemSearchResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new RmsResponseFormatError(
      `RMS商品検索レスポンスの形式が不正です: ${parsed.error.message}`
    );
  }

  const items: RmsItemModel[] = [];
  let skippedCount = 0;
  for (const result of parsed.data.results) {
    const item = result && typeof result === "object" ? (result as { item?: unknown }).item : undefined;
    const itemParsed = RmsItemModelSchema.safeParse(item);
    if (itemParsed.success) {
      items.push(itemParsed.data);
    } else {
      skippedCount += 1;
    }
  }

  return { numFound: parsed.data.numFound, items, skippedCount };
}
