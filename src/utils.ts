// 时间工具：统一使用本地 "YYYY-MM-DDTHH:mm" 字符串，便于 datetime-local 输入与展示

export function nowLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtTime(s?: string): string {
  return s ? s.replace("T", " ").slice(0, 16) : "—";
}

export function hoursBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
}
