export type ProductState = "公開中" | "公開予約" | "在庫注意" | "下書き";

export type ProductStockCell = {
  size: string;
  count: number;
};

export type ProductStockRow = {
  color: string;
  swatch: string;
  cells: number[];
};

export type Product = {
  id: string;
  name: string;
  code: string;
  category: string | null;
  material: string | null;
  season: string | null;
  price: string;
  stock: number | null;
  sold30d: number | null;
  cvr: string | null;
  revenue: string | null;
  rating: string | null;
  state: ProductState;
  updatedAt: string;
  description: string;
  imageUrl: string | null;
  colors: string[];
  sizes: string[];
  stockMatrix: ProductStockRow[];
  trend: number[];
};

export type ProductSchedule = {
  id: string;
  state: "確認済み" | "承認待ち";
  when: string;
  what: string;
};

export type ProductHistoryEntry = {
  id: string;
  when: string;
  what: string;
  who: string;
};

export type ProductDraft = {
  id: string;
  name: string;
  code: string;
  step: number;
  savedAt: string;
  owner: string;
};
