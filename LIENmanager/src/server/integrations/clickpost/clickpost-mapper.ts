import type { Order } from "@/generated/prisma/client";

import { ClickPostMappingError } from "./clickpost-errors";
import {
  CLICKPOST_ADDRESS_LINE_COUNT,
  CLICKPOST_ADDRESS_LINE_MAX_LENGTH,
  CLICKPOST_DEFAULT_CONTENTS,
  CLICKPOST_DEFAULT_HONORIFIC,
  type ClickPostCsvRow,
} from "./clickpost-types";

// Order(Prismaモデル) → ClickPostCsvRow への変換のみを責務とする。
export const ClickPostMapper = {
  toCsvRow(order: Order): ClickPostCsvRow {
    const postalCode = normalizePostalCode(order.postalCode, order.orderNumber);
    const recipientName = order.recipientName ?? order.ordererName;

    if (!recipientName || recipientName.trim().length === 0) {
      throw new ClickPostMappingError("お届け先氏名が取得できません", order.orderNumber);
    }

    const addressLines = buildAddressLines(order, order.orderNumber);

    return {
      postalCode,
      recipientName,
      honorific: CLICKPOST_DEFAULT_HONORIFIC,
      addressLine1: addressLines[0] ?? "",
      addressLine2: addressLines[1] ?? "",
      addressLine3: addressLines[2] ?? "",
      addressLine4: addressLines[3] ?? "",
      // 業務都合により、商品名の個別記載はせず常に固定文言とする。
      contents: CLICKPOST_DEFAULT_CONTENTS,
    };
  },
};

function normalizePostalCode(postalCode: string | null, orderNumber: string): string {
  if (!postalCode) {
    throw new ClickPostMappingError("郵便番号が取得できません", orderNumber);
  }

  const digitsOnly = postalCode.replace(/[^0-9]/g, "");
  if (digitsOnly.length !== 7) {
    throw new ClickPostMappingError(
      `郵便番号の桁数が不正です(7桁である必要がありますが${digitsOnly.length}桁でした)`,
      orderNumber
    );
  }

  return digitsOnly;
}

// 全角/半角の厳密な幅計算は未確認のため、文字数ベースの近似で分割する。
// 実画面(まとめ申込フォーム)で正確な文字数制限を確認できた際に見直すこと。
function buildAddressLines(order: Order, orderNumber: string): string[] {
  const combined = [order.prefecture, order.address1, order.address2]
    .filter((part): part is string => Boolean(part && part.trim().length > 0))
    .join("");

  if (combined.length === 0) {
    throw new ClickPostMappingError("住所が取得できません", orderNumber);
  }

  const lines: string[] = [];
  for (let i = 0; i < combined.length; i += CLICKPOST_ADDRESS_LINE_MAX_LENGTH) {
    lines.push(combined.slice(i, i + CLICKPOST_ADDRESS_LINE_MAX_LENGTH));
  }

  if (lines.length > CLICKPOST_ADDRESS_LINE_COUNT) {
    throw new ClickPostMappingError(
      `住所がクリックポストの上限(${CLICKPOST_ADDRESS_LINE_COUNT}行 × ${CLICKPOST_ADDRESS_LINE_MAX_LENGTH}文字)に収まりません`,
      orderNumber
    );
  }

  return lines;
}
