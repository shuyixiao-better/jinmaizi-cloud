import { describe, expect, it } from "vitest";
import { resolveRange } from "../src/worker/utils/time";

describe("resolveRange", () => {
  it("自定义日期按上海时区计算并包含结束日期全天", () => {
    expect(resolveRange("custom", "2026-08-01", "2026-08-31")).toEqual({
      start: "2026-07-31T16:00:00.000Z",
      end: "2026-08-31T16:00:00.000Z",
    });
  });
});
