// 保存层：localStorage 持久化。无后端、无额外依赖。
// 首次打开播种本地资料；之后沿用本地数据，页面重开状态不丢。

import type { Borehole, SampleRecord } from "../data/types";
import { BOREHOLES, buildSeedSamples } from "../data/seed";

const STORAGE_KEY = "hxwl-03.tracker.v1";

export interface PersistShape {
  readonly version: 1;
  readonly samples: readonly SampleRecord[];
}

export interface LoadResult {
  boreholes: readonly Borehole[];
  samples: SampleRecord[];
  /** 是否首次打开（本次播种） */
  seeded: boolean;
}

export function loadTracker(): LoadResult {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistShape;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.samples)) {
        return {
          boreholes: BOREHOLES,
          samples: parsed.samples as SampleRecord[],
          seeded: false,
        };
      }
    }
  } catch {
    // 本地数据损坏时回到播种数据，不让页面白屏
  }
  return { boreholes: BOREHOLES, samples: buildSeedSamples(), seeded: true };
}

export function saveTracker(samples: readonly SampleRecord[]): void {
  const payload: PersistShape = { version: 1, samples };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 隐私模式 / 配额不足时静默：当前会话仍可用
  }
}

export function resetTracker(): SampleRecord[] {
  const samples = buildSeedSamples();
  saveTracker(samples);
  return samples;
}

export function clearTracker(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
