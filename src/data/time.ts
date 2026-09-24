// 资料层：时刻工具。封样时刻以本地时间记录、原样保存，不做时区换算。

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Date -> datetime-local 控件值 yyyy-MM-ddTHH:mm */
export function toInputValue(date: Date): string {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join("-") +
    "T" +
    [pad2(date.getHours()), pad2(date.getMinutes())].join(":");
}

/** 当前时刻（用于台账时间戳） */
export function nowInputValue(): string {
  return toInputValue(new Date());
}

/** datetime-local 字符串 -> Date；无法解析返回 null */
export function parseInputValue(value: string): Date | null {
  if (!value) return null;
  const matched = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value.trim(),
  );
  if (!matched) return null;
  const [, y, mo, d, h, mi, s] = matched;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    s ? Number(s) : 0,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 展示用：yyyy-MM-dd HH:mm，无值返回 — */
export function displayTime(value: string | null): string {
  if (!value) return "—";
  return value.replace("T", " ").slice(0, 16);
}

/** 当前时刻相对 minutes 分钟之前的控件值 */
export function minutesAgoInputValue(minutes: number): string {
  return toInputValue(new Date(Date.now() - minutes * 60_000));
}
