export function money(cents: number, sign = false): string {
  const value = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(cents) / 100);
  const prefix = cents < 0 ? "-" : sign && cents > 0 ? "+" : "";
  return `${prefix}¥${value}`;
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(new Date(value)).replaceAll("/", "-");
}

export function shanghaiGreeting(value = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(value));
  if (hour < 6) return "凌晨好";
  if (hour < 12) return "上午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

export function yuanToCents(input: string): number | null {
  const value = input.trim();
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value)) return null;
  const [yuan = "0", fraction = ""] = value.split(".");
  const cents = Number(yuan) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 100_000_000_000 ? cents : null;
}

export const transactionLabel = (type: string) => ({ INITIAL: "初始余额", INCREASE: "增加", DECREASE: "扣减" })[type] ?? type;
export const actionLabel = (action: string) => ({
  LOGIN: "登录成功", LOGIN_FAILED: "登录失败", LOGIN_FAILED_DISABLED: "禁用账号登录失败", LOGOUT: "退出登录",
  CREATE_SUB_ACCOUNT: "创建子账号", UPDATE_SUB_ACCOUNT: "修改子账号", RESET_PASSWORD: "重置密码",
  ENABLE_SUB_ACCOUNT: "启用子账号", DISABLE_SUB_ACCOUNT: "禁用子账号", CREATE_CARD: "创建卡号",
  UPDATE_CARD: "修改卡号", ENABLE_CARD: "启用卡号", DISABLE_CARD: "禁用卡号",
  INCREASE: "增加金额", DECREASE: "扣减金额", CHANGE_PASSWORD: "修改密码",
})[action] ?? action;
