import { describe, expect, it } from "vitest";

import { inventoryKey } from "../rms-inventory-types";
import { RmsItemMapper } from "../rms-item-mapper";
import type { RmsItemModel } from "../rms-item-types";

const IMAGE_BASE_URL = "https://image.rakuten.co.jp/test-shop/cabinet";

function buildRmsItem(overrides: Partial<RmsItemModel> = {}): RmsItemModel {
  return {
    manageNumber: "1000000151",
    itemNumber: "YP-02",
    itemType: "NORMAL",
    title: "ワンピース レディース",
    tagline: "シワになりにくい生地をセレクトしました",
    images: [],
    genreId: 110729,
    hideItem: false,
    variantSelectors: [
      {
        key: "key-1",
        displayName: "カラー",
        values: [{ displayValue: "ベージュ" }, { displayValue: "ブラック" }],
      },
    ],
    variants: {
      "YP-02beige": {
        selectorValues: { "key-1": "ベージュ" },
        standardPrice: "3980",
        hidden: false,
        attributes: [
          { name: "シーズン", values: ["夏"] },
          { name: "素材（生地・毛糸）", values: ["ポリエステル100%"] },
          { name: "サイズ（S/M/L）", values: ["フリーサイズ"] },
        ],
      },
      "YP-02black": {
        selectorValues: { "key-1": "ブラック" },
        standardPrice: "4980",
        hidden: false,
        attributes: [
          { name: "シーズン", values: ["夏"] },
          { name: "素材（生地・毛糸）", values: ["ポリエステル100%"] },
          { name: "サイズ（S/M/L）", values: ["フリーサイズ"] },
        ],
      },
    },
    updated: "2026-09-14T20:58:31+09:00",
    created: "2026-01-01T00:00:00+09:00",
    ...overrides,
  } as RmsItemModel;
}

describe("RmsItemMapper.toProduct", () => {
  it("RMS商品モデルからProduct型へ変換する(基本ケース)", () => {
    const item = buildRmsItem();

    const product = RmsItemMapper.toProduct(item, IMAGE_BASE_URL);

    expect(product.id).toBe("1000000151");
    expect(product.name).toBe("ワンピース レディース");
    expect(product.code).toBe("YP-02");
    expect(product.state).toBe("公開中");
    expect(product.price).toBe("¥3,980〜¥4,980");
    expect(product.season).toBe("夏");
    expect(product.material).toBe("ポリエステル100%");
    expect(product.colors).toEqual(["#ddcbb4", "#2b2b2b"]);
    expect(product.sizes).toEqual(["フリーサイズ"]);
    expect(product.description).toBe("シワになりにくい生地をセレクトしました");
    expect(product.updatedAt).toBe("9/14 20:58");
  });

  it("hideItem:trueの商品は下書き扱いにする", () => {
    const item = buildRmsItem({ hideItem: true });

    const product = RmsItemMapper.toProduct(item, IMAGE_BASE_URL);

    expect(product.state).toBe("下書き");
  });

  it("在庫・売上・購入率・評価は商品APIに存在しないためnullにする(捏造しない)", () => {
    const item = buildRmsItem();

    const product = RmsItemMapper.toProduct(item, IMAGE_BASE_URL);

    expect(product.stock).toBeNull();
    expect(product.sold30d).toBeNull();
    expect(product.cvr).toBeNull();
    expect(product.revenue).toBeNull();
    expect(product.rating).toBeNull();
    expect(product.category).toBeNull();
    expect(product.stockMatrix).toEqual([]);
    expect(product.trend).toEqual([]);
  });

  it("バリアントが1件のみの場合は単一価格を表示する", () => {
    const item = buildRmsItem({
      variants: {
        only: {
          selectorValues: {},
          standardPrice: "2680",
          hidden: false,
          attributes: [],
        },
      },
    });

    const product = RmsItemMapper.toProduct(item, IMAGE_BASE_URL);

    expect(product.price).toBe("¥2,680");
  });

  it("価格情報が無い場合は「－」を表示する", () => {
    const item = buildRmsItem({ variants: {} });

    const product = RmsItemMapper.toProduct(item, IMAGE_BASE_URL);

    expect(product.price).toBe("－");
  });

  it("未知の色名は中間グレーへフォールバックする(捏造せず近似であることが分かる範囲)", () => {
    const item = buildRmsItem({
      variantSelectors: [
        {
          key: "key-1",
          displayName: "カラー",
          values: [{ displayValue: "テラコッタ" }],
        },
      ],
    });

    const product = RmsItemMapper.toProduct(item, IMAGE_BASE_URL);

    expect(product.colors).toEqual(["#c9c2b8"]);
  });

  it("CABINET画像がある場合、ショップ固有のimageBaseUrlと連結して画像URLを組み立てる", () => {
    const item = buildRmsItem({
      images: [{ type: "CABINET", location: "/12487046/12678117/yp02.jpg", alt: "商品画像" }],
    });

    const product = RmsItemMapper.toProduct(item, IMAGE_BASE_URL);

    expect(product.imageUrl).toBe(
      "https://image.rakuten.co.jp/test-shop/cabinet/12487046/12678117/yp02.jpg"
    );
  });

  it("画像が無い場合はimageUrlをnullにする(フロント側でグラデーション表示にフォールバック)", () => {
    const item = buildRmsItem({ images: [] });

    const product = RmsItemMapper.toProduct(item, IMAGE_BASE_URL);

    expect(product.imageUrl).toBeNull();
  });

  it("在庫API(inventoryByKey)を渡すと在庫数・在庫マトリクスに実数を反映する", () => {
    const item = buildRmsItem();
    const inventoryByKey = new Map<string, number>([
      [inventoryKey("1000000151", "YP-02beige"), 5],
      [inventoryKey("1000000151", "YP-02black"), 3],
    ]);

    const product = RmsItemMapper.toProduct(item, IMAGE_BASE_URL, inventoryByKey);

    expect(product.stock).toBe(8);
    expect(product.sizes).toEqual(["フリーサイズ"]);
    expect(product.stockMatrix).toEqual([
      { color: "ベージュ", swatch: "#ddcbb4", cells: [5] },
      { color: "ブラック", swatch: "#2b2b2b", cells: [3] },
    ]);
  });

  it("inventoryByKeyに該当バリアントが1件も無い場合は在庫「－」のままにする(捏造しない)", () => {
    const item = buildRmsItem();
    const inventoryByKey = new Map<string, number>([
      [inventoryKey("別の管理番号", "別のバリアント"), 99],
    ]);

    const product = RmsItemMapper.toProduct(item, IMAGE_BASE_URL, inventoryByKey);

    expect(product.stock).toBeNull();
    expect(product.stockMatrix).toEqual([]);
  });

  it("titleが無い場合はプレースホルダーを表示する", () => {
    const item = buildRmsItem({ title: undefined });

    const product = RmsItemMapper.toProduct(item, IMAGE_BASE_URL);

    expect(product.name).toBe("(タイトル未設定)");
  });
});
