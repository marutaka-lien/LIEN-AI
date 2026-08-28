import { describe, expect, it } from "vitest";

import { getJstDayRange } from "../date";

describe("getJstDayRange", () => {
  it("JST日中の時刻ならその日の0:00(JST)〜翌0:00(JST)を返す", () => {
    // 2026-07-28 15:00 JST = 2026-07-28 06:00 UTC
    const { start, end } = getJstDayRange(new Date("2026-07-28T06:00:00.000Z"));

    // 2026-07-28 00:00 JST = 2026-07-27 15:00 UTC
    expect(start.toISOString()).toBe("2026-07-27T15:00:00.000Z");
    // 2026-07-29 00:00 JST = 2026-07-28 15:00 UTC
    expect(end.toISOString()).toBe("2026-07-28T15:00:00.000Z");
  });

  it("UTC日付を跨ぐJST早朝の時刻でも正しくJSTの日付境界を返す", () => {
    // 2026-07-28 08:59 JST = 2026-07-27 23:59 UTC(UTC日付はまだ27日)
    const { start, end } = getJstDayRange(new Date("2026-07-27T23:59:00.000Z"));

    expect(start.toISOString()).toBe("2026-07-27T15:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-28T15:00:00.000Z");
  });
});
