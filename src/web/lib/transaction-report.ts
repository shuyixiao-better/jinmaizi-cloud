import { dateTime, money, transactionLabel } from "./format";

export interface ReportTransaction {
  card_no: string;
  operator_username?: string;
  transaction_type: string;
  amount_cents: number;
  remark: string;
  created_at: string;
}

const WIDTH = 1800;
const PADDING = 64;
const ROW_HEIGHT = 58;
const TABLE_TOP = 360;
const FOOTER_HEIGHT = 90;
const MAX_HEIGHT = 30_000;
const MAX_ROWS_PER_IMAGE = Math.floor((MAX_HEIGHT - TABLE_TOP - FOOTER_HEIGHT - ROW_HEIGHT) / ROW_HEIGHT);

function fitText(context: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  if (context.measureText(value).width <= maxWidth) return value;
  let result = value;
  while (result.length > 1 && context.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1);
  return `${result}…`;
}

async function loadLogo(): Promise<HTMLImageElement | null> {
  const image = new Image();
  image.src = "/brand/golden-wheat-logo.png";
  try { await image.decode(); return image; } catch { return null; }
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

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片生成失败，请重试")), "image/png"));
}

export async function downloadTransactionReport(
  items: ReportTransaction[],
  startDate: string,
  endDate: string,
): Promise<number> {
  if (!items.length) throw new Error("所选日期范围内没有交易流水");
  const increase = items.filter((item) => item.transaction_type === "INCREASE").reduce((sum, item) => sum + item.amount_cents, 0);
  const decrease = items.filter((item) => item.transaction_type === "DECREASE").reduce((sum, item) => sum + item.amount_cents, 0);
  const logo = await loadLogo();
  const partCount = Math.ceil(items.length / MAX_ROWS_PER_IMAGE);

  for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
    const partItems = items.slice(partIndex * MAX_ROWS_PER_IMAGE, (partIndex + 1) * MAX_ROWS_PER_IMAGE);
    const height = TABLE_TOP + ROW_HEIGHT + partItems.length * ROW_HEIGHT + FOOTER_HEIGHT;
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器不支持生成图片");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, WIDTH, height);
    if (logo) context.drawImage(logo, PADDING, 42, 150, 150);
    context.fillStyle = "#191814";
    context.font = "700 48px 'PingFang SC', 'Microsoft YaHei', sans-serif";
    context.fillText("交易流水月度报表", logo ? 240 : PADDING, 98);
    context.font = "26px 'PingFang SC', 'Microsoft YaHei', sans-serif";
    context.fillStyle = "#6b665d";
    context.fillText(`${startDate} 至 ${endDate}（中国标准时间）`, logo ? 240 : PADDING, 145);
    if (partCount > 1) context.fillText(`第 ${partIndex + 1} / ${partCount} 部分`, logo ? 240 : PADDING, 184);

    const summaryTop = 224;
    const summaryWidth = (WIDTH - PADDING * 2 - 36) / 3;
    const summaries = [
      ["交易笔数", `${items.length.toLocaleString("zh-CN")} 笔`],
      ["增加金额", money(increase)],
      ["扣减金额", money(decrease)],
    ];
    summaries.forEach(([label, value], index) => {
      const x = PADDING + index * (summaryWidth + 18);
      context.fillStyle = "#f7f4ec";
      context.fillRect(x, summaryTop, summaryWidth, 92);
      context.fillStyle = "#81796d";
      context.font = "22px 'PingFang SC', 'Microsoft YaHei', sans-serif";
      context.fillText(label ?? "", x + 24, summaryTop + 34);
      context.fillStyle = index === 2 ? "#b42318" : index === 1 ? "#087a55" : "#191814";
      context.font = "700 28px 'PingFang SC', 'Microsoft YaHei', sans-serif";
      context.fillText(value ?? "", x + 24, summaryTop + 72);
    });

    const columns = [
      { label: "序号", x: 64, width: 90 },
      { label: "时间", x: 154, width: 300 },
      { label: "卡号", x: 454, width: 210 },
      { label: "操作账号", x: 664, width: 230 },
      { label: "类型", x: 894, width: 150 },
      { label: "金额", x: 1044, width: 230 },
      { label: "备注", x: 1274, width: 462 },
    ];
    context.fillStyle = "#201f1b";
    context.fillRect(PADDING, TABLE_TOP, WIDTH - PADDING * 2, ROW_HEIGHT);
    context.fillStyle = "#ffffff";
    context.font = "600 22px 'PingFang SC', 'Microsoft YaHei', sans-serif";
    columns.forEach((column) => context.fillText(column.label, column.x + 14, TABLE_TOP + 37));

    partItems.forEach((item, index) => {
      const y = TABLE_TOP + ROW_HEIGHT + index * ROW_HEIGHT;
      context.fillStyle = index % 2 === 0 ? "#ffffff" : "#faf9f6";
      context.fillRect(PADDING, y, WIDTH - PADDING * 2, ROW_HEIGHT);
      context.strokeStyle = "#e8e5de";
      context.beginPath(); context.moveTo(PADDING, y + ROW_HEIGHT); context.lineTo(WIDTH - PADDING, y + ROW_HEIGHT); context.stroke();
      context.font = "22px 'PingFang SC', 'Microsoft YaHei', sans-serif";
      const values = [
        String(partIndex * MAX_ROWS_PER_IMAGE + index + 1), dateTime(item.created_at), item.card_no,
        item.operator_username || "—", transactionLabel(item.transaction_type),
        `${item.transaction_type === "DECREASE" ? "-" : "+"}${money(item.amount_cents)}`, item.remark || "—",
      ];
      columns.forEach((column, columnIndex) => {
        context.fillStyle = columnIndex === 5 ? (item.transaction_type === "DECREASE" ? "#b42318" : "#087a55") : "#37342f";
        context.fillText(fitText(context, values[columnIndex] ?? "", column.width - 28), column.x + 14, y + 37);
      });
    });

    context.fillStyle = "#8b857a";
    context.font = "20px 'PingFang SC', 'Microsoft YaHei', sans-serif";
    const generatedAt = dateTime(new Date().toISOString());
    context.fillText(`生成时间：${generatedAt}　｜　金麦子云系统`, PADDING, height - 34);
    const suffix = partCount > 1 ? `-第${partIndex + 1}部分` : "";
    downloadBlob(await canvasBlob(canvas), `交易流水_${startDate}_${endDate}${suffix}.png`);
  }
  return partCount;
}
