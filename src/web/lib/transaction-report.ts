import { transactionLabel } from "./format";

export interface ReportTransaction {
  request_id?: string;
  card_no: string;
  operator_username?: string;
  transaction_type: string;
  amount_cents: number;
  remark: string;
  created_at: string;
}

const BORDER_COLOR = "FFD9D9D9";
const HEADER_COLOR = "FF737373";
const TITLE_COLOR = "FF5A3A1F";
const LIGHT_FILL = "FFF7F4EC";
const RED = "FFFF0000";
const GREEN = "FF087A55";

export function transactionReportFilename(startDate: string, endDate: string): string {
  return `交易流水_${startDate}至${endDate}.xlsx`;
}

function shanghaiExcelDate(value: string): Date {
  const date = new Date(value);
  return new Date(date.getTime() + 8 * 60 * 60 * 1_000);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function downloadTransactionReport(
  items: ReportTransaction[],
  startDate: string,
  endDate: string,
): Promise<void> {
  if (!items.length) throw new Error("所选日期范围内没有交易流水");
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "金麦子云系统";
  workbook.lastModifiedBy = "金麦子云系统";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.title = `交易流水 ${startDate} 至 ${endDate}`;
  workbook.subject = "超级管理员交易流水导出";

  const sheet = workbook.addWorksheet("交易流水", {
    views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    properties: { defaultRowHeight: 20 },
  });
  sheet.pageSetup.printTitlesRow = "1:4";
  sheet.headerFooter.oddFooter = "金麦子云系统　　第 &P 页，共 &N 页";
  sheet.columns = [
    { key: "index", width: 8 },
    { key: "cardNo", width: 18 },
    { key: "type", width: 13 },
    { key: "amount", width: 16 },
    { key: "increase", width: 16 },
    { key: "decrease", width: 16 },
    { key: "createdAt", width: 23 },
    { key: "operator", width: 18 },
    { key: "remark", width: 30 },
    { key: "requestId", width: 38 },
  ];

  sheet.mergeCells("A1:J1");
  const title = sheet.getCell("A1");
  title.value = `交易流水明细（${startDate} 00:00:00——${endDate} 23:59:59）`;
  title.font = { name: "微软雅黑", size: 18, bold: true, color: { argb: TITLE_COLOR } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 34;

  const increaseCents = items.filter((item) => item.transaction_type === "INCREASE").reduce((sum, item) => sum + item.amount_cents, 0);
  const decreaseCents = items.filter((item) => item.transaction_type === "DECREASE").reduce((sum, item) => sum + item.amount_cents, 0);
  const summary = [
    ["交易笔数", items.length],
    ["增加合计", increaseCents / 100],
    ["扣减合计", -decreaseCents / 100],
    ["净变动", (increaseCents - decreaseCents) / 100],
  ] as const;
  const summaryRanges = ["A2:B2", "C2:D2", "E2:F2", "G2:J2"];
  summary.forEach(([label, value], index) => {
    const range = summaryRanges[index]!;
    sheet.mergeCells(range);
    const cell = sheet.getCell(range.split(":")[0]!);
    cell.value = `${label}：${index === 0 ? `${value} 笔` : `¥${Number(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}`;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_FILL } };
    cell.font = { name: "微软雅黑", size: 11, bold: true, color: { argb: index === 2 ? RED : index > 0 ? GREEN : "FF333333" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: BORDER_COLOR } }, bottom: { style: "thin", color: { argb: BORDER_COLOR } },
      left: { style: "thin", color: { argb: BORDER_COLOR } }, right: { style: "thin", color: { argb: BORDER_COLOR } },
    };
  });
  sheet.getRow(2).height = 28;
  sheet.getRow(3).height = 8;

  const headers = ["序号", "卡号", "操作类型", "交易金额", "增加金额", "扣减金额", "交易时间", "操作账号", "备注", "交易单号"];
  const headerRow = sheet.getRow(4);
  headerRow.values = headers;
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_COLOR } };
    cell.font = { name: "微软雅黑", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF666666" } }, bottom: { style: "thin", color: { argb: "FF666666" } },
      left: { style: "thin", color: { argb: "FF666666" } }, right: { style: "thin", color: { argb: "FF666666" } },
    };
  });

  items.forEach((item, index) => {
    const rowNumber = index + 5;
    const row = sheet.getRow(rowNumber);
    row.values = [
      index + 1,
      item.card_no,
      transactionLabel(item.transaction_type),
      item.amount_cents / 100,
      item.transaction_type === "INCREASE" ? item.amount_cents / 100 : null,
      item.transaction_type === "DECREASE" ? -item.amount_cents / 100 : null,
      shanghaiExcelDate(item.created_at),
      item.operator_username || "—",
      item.remark || "—",
      item.request_id || "—",
    ];
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.font = { name: "微软雅黑", size: 10, color: { argb: columnNumber === 6 ? RED : "FF333333" } };
      cell.alignment = { horizontal: [1, 3, 7].includes(columnNumber) ? "center" : columnNumber >= 4 && columnNumber <= 6 ? "right" : "left", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 === 0 ? "FFFFFFFF" : "FFFAFAF8" } };
      cell.border = {
        top: { style: "thin", color: { argb: BORDER_COLOR } }, bottom: { style: "thin", color: { argb: BORDER_COLOR } },
        left: { style: "thin", color: { argb: BORDER_COLOR } }, right: { style: "thin", color: { argb: BORDER_COLOR } },
      };
    });
    row.getCell(2).numFmt = "@";
    row.getCell(4).numFmt = '¥#,##0.00;[Red](¥#,##0.00)';
    row.getCell(5).numFmt = '¥#,##0.00;[Red](¥#,##0.00)';
    row.getCell(6).numFmt = '¥#,##0.00;[Red](¥#,##0.00)';
    row.getCell(7).numFmt = "yyyy-mm-dd hh:mm:ss";
    row.getCell(10).numFmt = "@";
  });

  const totalRowNumber = items.length + 5;
  const totalRow = sheet.getRow(totalRowNumber);
  totalRow.values = ["合计", "", "", { formula: `SUM(D5:D${totalRowNumber - 1})` }, { formula: `SUM(E5:E${totalRowNumber - 1})` }, { formula: `SUM(F5:F${totalRowNumber - 1})` }, "", "", "", ""];
  sheet.mergeCells(`A${totalRowNumber}:C${totalRowNumber}`);
  totalRow.height = 25;
  totalRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE9E1" } };
    cell.font = { name: "微软雅黑", size: 11, bold: true, color: { argb: columnNumber === 6 ? RED : "FF333333" } };
    cell.alignment = { horizontal: columnNumber <= 3 ? "center" : columnNumber <= 6 ? "right" : "left", vertical: "middle" };
    cell.border = {
      top: { style: "medium", color: { argb: "FF999999" } }, bottom: { style: "thin", color: { argb: BORDER_COLOR } },
      left: { style: "thin", color: { argb: BORDER_COLOR } }, right: { style: "thin", color: { argb: BORDER_COLOR } },
    };
  });
  [4, 5, 6].forEach((columnNumber) => { totalRow.getCell(columnNumber).numFmt = '¥#,##0.00;[Red](¥#,##0.00)'; });

  sheet.autoFilter = { from: "A4", to: `J${totalRowNumber - 1}` };
  sheet.pageSetup.printArea = `A1:J${totalRowNumber}`;
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  downloadBlob(new Blob([arrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), transactionReportFilename(startDate, endDate));
}
