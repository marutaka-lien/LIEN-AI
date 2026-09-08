// 宛先(郵便番号+氏名+住所)から突き合わせキーを作る。
// クリックポスト追跡番号CSVには注文番号が無いため、宛先の一致で注文データと結びつける。
// 注文データ側とクリックポスト側の両方へ、まったく同じ正規化を通すこと。

import { normalizeForClickPostCsv } from "@/server/integrations/clickpost/clickpost-charset";
import type { ShippingReportTargetOrder } from "./rms-shipping-report-types";

// 全角スペース・タブを含むあらゆる空白を除去する。
const ALL_WHITESPACE = /\s|　/g;

// NFKC 正規化 + 空白全除去 + ハイフン/ダッシュ類を半角 "-" へ統一。
// あえてやらないこと: 漢数字↔算用数字の変換、ビル名・部屋番号の有無の吸収。
// ここまでやると誤マッチのリスクが上がるため、吸収できないズレは未マッチとして
// 人手に回す(Gate 1 の方針)。
function normalizeText(value: string): string {
  return normalizeForClickPostCsv(value.normalize("NFKC")).replace(ALL_WHITESPACE, "");
}

// 郵便番号は数字だけ取り出して7桁にする。7桁でなければ空文字を返す(キー不成立)。
// 全角数字(１５０-…)も拾えるよう、数字抽出の前に NFKC 正規化する。
export function normalizePostalCode7(value: string | null | undefined): string {
  const digits = (value ?? "").normalize("NFKC").replace(/\D/g, "");
  return digits.length === 7 ? digits : "";
}

export function normalizeName(value: string | null | undefined): string {
  return normalizeText(value ?? "");
}

export function normalizeAddress(value: string | null | undefined): string {
  return normalizeText(value ?? "");
}

// 突き合わせキー。3要素のいずれかが空なら空文字を返し、呼び出し側で「キー不成立
// (=突き合わせ対象外)」として扱う。
export function buildAddressKey(parts: {
  postalCode: string | null | undefined;
  name: string | null | undefined;
  address: string | null | undefined;
}): string {
  const postal = normalizePostalCode7(parts.postalCode);
  const name = normalizeName(parts.name);
  const address = normalizeAddress(parts.address);
  if (!postal || !name || !address) return "";
  return `${postal}|${name}|${address}`;
}

// 注文データ側のキー。氏名は recipientName を優先し、無ければ ordererName へフォールバック。
// 住所は prefecture + address1 + address2 を区切り無しで連結してから正規化する
// (クリックポスト側の住所1本と粒度を合わせるため)。
export function buildOrderAddressKey(order: ShippingReportTargetOrder): string {
  const name = order.recipientName ?? order.ordererName;
  const address = `${order.prefecture ?? ""}${order.address1 ?? ""}${order.address2 ?? ""}`;
  return buildAddressKey({ postalCode: order.postalCode, name, address });
}
