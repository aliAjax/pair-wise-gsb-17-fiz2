// 判定层：登记/更正后的复核规则与状态推导

import type { Hole, Layer, SampleRecord, SampleStatus } from "./types";
import { hoursBetween } from "./utils";

export const SEAL_LIMIT_HOURS = 2;

/**
 * 复核当前版本，返回问题清单（问题文本中含“深度差”，便于检索）。
 * 规则：起止深度须落在该孔某一已编录分层内；样号同孔唯一；取样至封样不得超过两小时。
 */
export function validateSample(
  target: SampleRecord,
  others: SampleRecord[],
  layers: Layer[],
  holes: Hole[]
): string[] {
  const v = target.versions[target.versions.length - 1];
  const issues: string[] = [];
  const hole = holes.find((h) => h.id === target.holeId);

  if (!hole) {
    issues.push(`孔号 ${target.holeId} 未在编录中`);
  } else if (!(v.top < v.bottom)) {
    issues.push(`起止深度异常：${v.top}~${v.bottom}m`);
  } else if (v.bottom > hole.depth) {
    issues.push(
      `深度 ${v.top}~${v.bottom}m 超出已编录孔深 ${hole.depth}m，深度差 ${(v.bottom - hole.depth).toFixed(2)}m`
    );
  } else {
    const holeLayers = layers
      .filter((l) => l.holeId === target.holeId)
      .sort((a, b) => a.top - b.top);
    const hit = holeLayers.find((l) => v.top >= l.top && v.bottom <= l.bottom);
    if (!hit) {
      const startLayer = holeLayers.find((l) => v.top >= l.top && v.top < l.bottom);
      let diff: number;
      let note: string;
      if (startLayer) {
        diff = v.bottom - startLayer.bottom;
        note = `跨越${startLayer.soil}层底界 ${startLayer.bottom}m`;
      } else if (holeLayers.length > 0 && v.top < holeLayers[0].top) {
        diff = holeLayers[0].top - v.top;
        note = `浅于首个分层顶界 ${holeLayers[0].top}m`;
      } else {
        diff = 0;
        note = "落在分层空档";
      }
      issues.push(
        `深度 ${v.top}~${v.bottom}m 与已编录分层对不上：${note}，深度差 ${diff.toFixed(2)}m`
      );
    }
  }

  const dup = others.find((r) => r.holeId === target.holeId && r.sampleNo === target.sampleNo);
  if (dup) {
    issues.push(`样号重复：${target.sampleNo} 已在 ${target.holeId} 回次${dup.runNo} 登记`);
  }

  const hours = hoursBetween(v.sampledAt, v.sealedAt);
  if (Number.isFinite(hours)) {
    if (hours < 0) {
      issues.push("封样时刻早于取样时刻");
    } else if (hours > SEAL_LIMIT_HOURS) {
      issues.push(`封样超过两小时：取样至封样 ${hours.toFixed(1)}h`);
    }
  }

  return issues;
}

/** 由复核结果推导状态：有问题留待复核；已入库的更正保持入库（原版本冻结）；其余进入已送检 */
export function statusFor(issues: string[], prev?: SampleStatus): SampleStatus {
  if (issues.length > 0) return "pending";
  if (prev === "archived") return "archived";
  return "sent";
}
