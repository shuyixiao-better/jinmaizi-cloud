export interface DateRange { start: string; end: string }

function shanghaiDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function shanghaiMidnightUtc(date: Date, dayOffset = 0): Date {
  const { year, month, day } = shanghaiDateParts(date);
  return new Date(Date.UTC(year, month - 1, day + dayOffset, -8));
}

export function presetRange(preset: string | undefined, now = new Date()): DateRange {
  const today = shanghaiMidnightUtc(now);
  const tomorrow = shanghaiMidnightUtc(now, 1);
  if (preset === "yesterday") {
    return { start: new Date(today.getTime() - 86_400_000).toISOString(), end: today.toISOString() };
  }
  if (preset === "7d") return { start: new Date(today.getTime() - 6 * 86_400_000).toISOString(), end: tomorrow.toISOString() };
  if (preset === "30d") return { start: new Date(today.getTime() - 29 * 86_400_000).toISOString(), end: tomorrow.toISOString() };
  return { start: today.toISOString(), end: tomorrow.toISOString() };
}

export function resolveRange(
  preset: string | undefined,
  customStart: string | undefined,
  customEnd: string | undefined,
): DateRange {
  if (preset === "custom" && customStart && customEnd && /^\d{4}-\d{2}-\d{2}$/.test(customStart) && /^\d{4}-\d{2}-\d{2}$/.test(customEnd)) {
    const start = new Date(`${customStart}T00:00:00+08:00`);
    const end = new Date(`${customEnd}T00:00:00+08:00`);
    end.setUTCDate(end.getUTCDate() + 1);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
      return { start: start.toISOString(), end: end.toISOString() };
    }
  }
  return presetRange(preset);
}
