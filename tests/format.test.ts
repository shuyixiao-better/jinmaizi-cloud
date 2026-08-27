import { describe, expect, it } from "vitest";
import { shanghaiGreeting } from "../src/web/lib/format";

describe("shanghaiGreeting", () => {
  it.each([
    ["2026-08-26T20:30:00.000Z", "凌晨好"],
    ["2026-08-27T01:30:00.000Z", "上午好"],
    ["2026-08-27T08:43:00.000Z", "下午好"],
    ["2026-08-27T12:30:00.000Z", "晚上好"],
  ])("按上海时区将 %s 显示为 %s", (iso, expected) => {
    expect(shanghaiGreeting(new Date(iso))).toBe(expected);
  });
});
