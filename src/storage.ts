// 保存层：localStorage 读写，页面重开后待复核/已送检/已入库等状态不丢

import type { AppState } from "./types";
import { seedState } from "./data/seed";

const KEY = "hxwl-03-sample-tracking-v1";

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && Array.isArray(parsed.records) && Array.isArray(parsed.holes)) {
        return parsed;
      }
    }
  } catch {
    // 本地数据损坏时回退到初始资料
  }
  return seedState();
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时静默失败，界面仍可操作
  }
}
