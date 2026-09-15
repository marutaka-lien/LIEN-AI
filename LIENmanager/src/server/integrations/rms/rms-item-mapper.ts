import type { Product, ProductState, ProductStockRow } from "@/types/product";
import { inventoryKey } from "./rms-inventory-types";
import type { RmsItemModel, RmsItemVariant } from "./rms-item-types";

// RmsItemModel(RMS商品API固有の形) → アプリ共通のProduct型への変換のみを責務とする。
//
// 既知の制約: 商品API 2.0には売上・購入率・レビュー評価が含まれない(RMSに存在しない
// 社内集計値のため)。これらは実データが無いままダミー値を表示すると捏造に見えるため、
// null(表示側で「－」)とする。2026-09-15 マスター指示: 売れ行き系はマスターが別途
// CSVから作成するまで待つ。在庫数は在庫API 2.0(inventories.bulk-get)から実数を取れるため
// inventoryByKey(呼び出し側で一括取得済みのMap)を渡された場合のみ実数を載せる。
export const RmsItemMapper = {
  // imageBaseUrl: RmsConfig.itemImageBaseUrl(例: https://image.rakuten.co.jp/{ショップURL}/cabinet)。
  // R-Cabinet画像のURLはショップ固有のため、このファイル内にドメインを埋め込まず呼び出し側から渡す。
  // inventoryByKey: `${manageNumber}::${variantId}` -> 在庫数。未指定の場合は在庫「－」表示のまま
  // (在庫APIを呼ばない/呼べなかった場合でも商品一覧自体は表示できるようにするため)。
  toProduct(item: RmsItemModel, imageBaseUrl: string, inventoryByKey?: Map<string, number>): Product {
    const variantEntries = Object.entries(item.variants ?? {});
    const variants = variantEntries.map(([, v]) => v);
    const prices = variants
      .map((v) => (v.standardPrice !== undefined ? Number(v.standardPrice) : NaN))
      .filter((n) => Number.isFinite(n));

    const colorNames = extractColorNames(item);
    const sizeNames = extractSizeNames(item, variants);
    const stock = buildStock(item, variantEntries, colorNames, sizeNames, inventoryByKey);

    return {
      id: item.manageNumber,
      name: stripPromoPrefix(item.title) ?? "(タイトル未設定)",
      code: item.itemNumber ?? item.manageNumber,
      category: null,
      material: findAttributeValue(variants, "素材"),
      season: findAttributeValue(variants, "シーズン"),
      price: formatPriceRange(prices),
      stock: stock.total,
      sold30d: null,
      cvr: null,
      revenue: null,
      rating: null,
      state: deriveState(item.hideItem),
      updatedAt: formatUpdatedAt(item.updated),
      description: item.tagline ?? "",
      imageUrl: extractImageUrl(item, imageBaseUrl),
      colors: colorNames.map(colorNameToHex),
      sizes: stock.sizes,
      stockMatrix: stock.matrix,
      trend: [],
    };
  },
};

// 楽天の商品名は先頭に「【15日は当店P5倍＆クーポンあり】」のような販促文言が付くことが多く、
// 一覧カードの限られた幅で省略表示すると販促文言しか見えず商品名が分からなくなる。
// 先頭1個だけの【...】を取り除き、実際の商品名から表示・省略できるようにする
// (本文中の【】や複数連続する【】はそのまま残す＝過剰に削らない)。
function stripPromoPrefix(title: string | undefined): string | null {
  if (!title) return null;
  const stripped = title.replace(/^【[^】]*】\s*/, "").trim();
  return stripped.length > 0 ? stripped : title;
}

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

function variantSelectorKey(item: RmsItemModel, nameIncludes: string): string | undefined {
  return (item.variantSelectors ?? []).find((s) => (s.displayName ?? "").includes(nameIncludes))
    ?.key;
}

// バリアント1件の色を決める。カラーのセレクター値を優先し、無ければ属性(カラー系)を見る。
function colorForVariant(variant: RmsItemVariant, colorSelectorKey: string | undefined): string | null {
  if (colorSelectorKey) {
    const fromSelector = variant.selectorValues?.[colorSelectorKey];
    if (fromSelector) return fromSelector;
  }
  const attribute = (variant.attributes ?? []).find((a) => a.name.includes("カラー"));
  return attribute?.values[0] ?? null;
}

// バリアント1件のサイズを決める。extractSizeNamesと同じ優先順位(セレクター→属性)。
function sizeForVariant(variant: RmsItemVariant, sizeSelectorKey: string | undefined): string | null {
  if (sizeSelectorKey) {
    const fromSelector = variant.selectorValues?.[sizeSelectorKey];
    if (fromSelector) return fromSelector;
  }
  const attribute = (variant.attributes ?? []).find((a) => a.name.includes("サイズ"));
  return attribute?.values[0] ?? null;
}

interface StockResult {
  total: number | null;
  matrix: ProductStockRow[];
  sizes: string[];
}

// 在庫API(inventories.bulk-get)の結果をバリアント単位で突き合わせ、
// 色×サイズの在庫表と合計在庫数を組み立てる。inventoryByKeyが無い/該当が1件も
// 無い場合は在庫「－」のまま(捏造しない)。
function buildStock(
  item: RmsItemModel,
  variantEntries: Array<[string, RmsItemVariant]>,
  colorNames: string[],
  sizeNames: string[],
  inventoryByKey: Map<string, number> | undefined
): StockResult {
  if (!inventoryByKey) return { total: null, matrix: [], sizes: sizeNames };

  const colorSelectorKey = variantSelectorKey(item, "カラー");
  const sizeSelectorKey = variantSelectorKey(item, "サイズ");
  const effectiveColors = colorNames.length > 0 ? colorNames : ["本体"];
  const effectiveSizes = sizeNames.length > 0 ? sizeNames : ["数量"];

  const cellQuantities = new Map<string, number>();
  let total = 0;
  let matched = false;

  for (const [variantId, variant] of variantEntries) {
    const quantity = inventoryByKey.get(inventoryKey(item.manageNumber, variantId));
    if (quantity === undefined) continue;
    matched = true;
    total += quantity;

    const color = colorForVariant(variant, colorSelectorKey) ?? effectiveColors[0];
    const size = sizeForVariant(variant, sizeSelectorKey) ?? effectiveSizes[0];
    const cellKey = `${color}::${size}`;
    cellQuantities.set(cellKey, (cellQuantities.get(cellKey) ?? 0) + quantity);
  }

  if (!matched) return { total: null, matrix: [], sizes: sizeNames };

  const matrix: ProductStockRow[] = effectiveColors.map((color) => ({
    color,
    swatch: colorNames.length > 0 ? colorNameToHex(color) : "#c9c2b8",
    cells: effectiveSizes.map((size) => cellQuantities.get(`${color}::${size}`) ?? 0),
  }));

  return { total, matrix, sizes: effectiveSizes };
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
