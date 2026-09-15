import type { Product, ProductState, ProductStockRow } from "@/types/product";
import type { RmsItemModel, RmsItemVariant } from "./rms-item-types";

// RmsItemModel(RMS商品API固有の形) → アプリ共通のProduct型への変換のみを責務とする。
//
// 既知の制約: 商品API 2.0には在庫数・売上・購入率・レビュー評価が含まれない
// (在庫は在庫API、売上等はRMSに存在しない社内集計値のため)。これらは実データが
// 無いままダミー値を表示すると捏造に見えるため、null(表示側で「－」)とする。
// 2026-09-15 マスター指示: 週次販売数字の記録が十分に蓄積してから実データを載せる。
export const RmsItemMapper = {
  // imageBaseUrl: RmsConfig.itemImageBaseUrl(例: https://image.rakuten.co.jp/{ショップURL}/cabinet)。
  // R-Cabinet画像のURLはショップ固有のため、このファイル内にドメインを埋め込まず呼び出し側から渡す。
  toProduct(item: RmsItemModel, imageBaseUrl: string): Product {
    const variants = Object.values(item.variants ?? {});
    const prices = variants
      .map((v) => (v.standardPrice !== undefined ? Number(v.standardPrice) : NaN))
      .filter((n) => Number.isFinite(n));

    const colorNames = extractColorNames(item);
    const sizeNames = extractSizeNames(item, variants);

    return {
      id: item.manageNumber,
      name: item.title ?? "(タイトル未設定)",
      code: item.itemNumber ?? item.manageNumber,
      category: null,
      material: findAttributeValue(variants, "素材"),
      season: findAttributeValue(variants, "シーズン"),
      price: formatPriceRange(prices),
      stock: null,
      sold30d: null,
      cvr: null,
      revenue: null,
      rating: null,
      state: deriveState(item.hideItem),
      updatedAt: formatUpdatedAt(item.updated),
      description: item.tagline ?? "",
      imageUrl: extractImageUrl(item, imageBaseUrl),
      colors: colorNames.map(colorNameToHex),
      sizes: sizeNames,
      stockMatrix: [] as ProductStockRow[],
      trend: [],
    };
  },
};

function extractImageUrl(item: RmsItemModel, imageBaseUrl: string): string | null {
  const image =
    (item.images ?? []).find((img) => img.type === "CABINET" && img.location) ??
    (item.images ?? []).find((img) => img.location);
  if (!image?.location) return null;
  return `${imageBaseUrl}${image.location}`;
}

function deriveState(hideItem: boolean | undefined): ProductState {
  return hideItem ? "下書き" : "公開中";
}

function formatPriceRange(prices: number[]): string {
  if (prices.length === 0) return "－";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return `¥${min.toLocaleString("ja-JP")}`;
  return `¥${min.toLocaleString("ja-JP")}〜¥${max.toLocaleString("ja-JP")}`;
}

function formatUpdatedAt(updated: string | undefined): string {
  if (!updated) return "－";
  const date = new Date(updated);
  if (Number.isNaN(date.getTime())) return "－";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function extractColorNames(item: RmsItemModel): string[] {
  const colorSelector = (item.variantSelectors ?? []).find((s) =>
    (s.displayName ?? "").includes("カラー")
  );
  const names =
    colorSelector?.values
      .map((v) => v.displayValue)
      .filter((v): v is string => Boolean(v)) ?? [];
  return Array.from(new Set(names));
}

function extractSizeNames(item: RmsItemModel, variants: RmsItemVariant[]): string[] {
  const sizeSelector = (item.variantSelectors ?? []).find((s) =>
    (s.displayName ?? "").includes("サイズ")
  );
  const fromSelector =
    sizeSelector?.values.map((v) => v.displayValue).filter((v): v is string => Boolean(v)) ?? [];
  if (fromSelector.length > 0) return Array.from(new Set(fromSelector));

  const fromAttributes = variants.flatMap((v) =>
    (v.attributes ?? [])
      .filter((a) => a.name.includes("サイズ"))
      .flatMap((a) => a.values ?? [])
  );
  return Array.from(new Set(fromAttributes));
}

function findAttributeValue(variants: RmsItemVariant[], nameIncludes: string): string | null {
  for (const variant of variants) {
    const attribute = (variant.attributes ?? []).find((a) => a.name.includes(nameIncludes));
    if (attribute && attribute.values.length > 0) return attribute.values.join("・");
  }
  return null;
}

// 商品API 2.0のカラー値は表示名(日本語)のみでスウォッチ用の色コードを持たないため、
// よく使う色名をあらかじめ対応させ、未知の色名は中間グレーにフォールバックする
// (実際の色と異なりうるが、捏造ではなく「表示上の近似」であることが分かる範囲の妥協)。
const COLOR_NAME_TO_HEX: Record<string, string> = {
  ホワイト: "#f5f3ee",
  白: "#f5f3ee",
  オフホワイト: "#efe6d8",
  アイボリー: "#efe6d8",
  ベージュ: "#ddcbb4",
  キャメル: "#c9a06b",
  ブラウン: "#6f5b4a",
  カーキ: "#7f7a5c",
  グリーン: "#5c7a5c",
  セージ: "#8f9d8c",
  ネイビー: "#2f3a52",
  ブルー: "#3f5c8a",
  サックス: "#93a2c4",
  グレー: "#9aa398",
  チャコール: "#4a4a48",
  ブラック: "#2b2b2b",
  黒: "#2b2b2b",
  レッド: "#a3453f",
  ピンク: "#d8a8a3",
  イエロー: "#d8c97f",
  マスタード: "#c9a84a",
  パープル: "#7a6a8a",
};

function colorNameToHex(name: string): string {
  for (const [key, hex] of Object.entries(COLOR_NAME_TO_HEX)) {
    if (name.includes(key)) return hex;
  }
  return "#c9c2b8";
}
