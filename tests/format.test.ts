import { describe, expect, it } from "vitest";
import { previousMonthDateRange, shanghaiGreeting } from "../src/web/lib/format";
import { transactionReportFilename } from "../src/web/lib/transaction-report";

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

describe("previousMonthDateRange", () => {
  it("按上海时区返回上一个完整自然月", () => {
    expect(previousMonthDateRange(new Date("2026-09-01T00:30:00.000Z"))).toEqual({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    });
  });

  it("跨年时返回上一年十二月", () => {
    expect(previousMonthDateRange(new Date("2026-01-15T00:00:00.000Z"))).toEqual({
      startDate: "2025-12-01",
      endDate: "2025-12-31",
    });
  });
});

describe("transactionReportFilename", () => {
  it("使用所选日期范围生成 Excel 文件名", () => {
    expect(transactionReportFilename("2026-08-01", "2026-08-31")).toBe("交易流水_2026-08-01至2026-08-31.xlsx");
  });
});
