// 判定层：现场登记规则
// 1) 深度必须与已编录分层对得上（落在同一层内、边界容差内）；
// 2) 样号全孔不得重复（已被更正替代的旧版记录不参与查重）；
// 3) 封样时刻早于登记时刻超过两小时先留待复核。

import type {
  Borehole,
  Issue,
  IssueCode,
  SampleDraft,
  SampleRecord,
} from "../data/types";
import { parseInputValue } from "../data/time";

/** 分层边界对齐容差 m（岩芯断面 / 量测误差） */
export const DEPTH_TOLERANCE = 0.05;
/** 封样与登记之间允许的最大间隔（分钟） */
export const SEAL_LIMIT_MINUTES = 120;

export interface ValidationContext {
  boreholes: readonly Borehole[];
  /** 当前台账中仍有效（未被新版本替代）的记录，用于样号查重 */
  activeRecords: readonly SampleRecord[];
  /** 登记时刻，默认当前时刻 */
  registeredAt?: Date;
  /** 更新时自身 id，查重排除自己 */
  selfId?: string;
}

function issue(code: IssueCode, message: string, depthGap?: number): Issue {
  return { code, message, ...(depthGap === undefined ? {} : { depthGap }) };
}

/**
 * 深度与分层核对。
 * 样段应完整落在同一已编录分层内（允许边界容差）；
 * 返回 null 表示对得上，否则返回问题。跨层时 depthGap 为样段越过该层底板的长度。
 */
export function checkDepth(
  hole: Borehole,
  depthFrom: number,
  depthTo: number,
): Issue | null {
  if (depthFrom < -DEPTH_TOLERANCE) {
    return issue(
      "DEPTH_MISMATCH",
      `起深 ${depthFrom}m 浅于孔口（深度差 ${Math.abs(depthFrom).toFixed(2)}m）`,
      Number(Math.abs(depthFrom).toFixed(2)),
    );
  }
  if (depthTo > hole.totalDepth + DEPTH_TOLERANCE) {
    const gap = Number((depthTo - hole.totalDepth).toFixed(2));
    return issue(
      "DEPTH_MISMATCH",
      `止深 ${depthTo}m 超出孔深 ${hole.totalDepth}m（深度差 ${gap}m）`,
      gap,
    );
  }

  // 起深所在分层
  const owner = hole.layers.find(
    (layer) =>
      depthFrom >= layer.top - DEPTH_TOLERANCE &&
      depthFrom < layer.bottom + DEPTH_TOLERANCE,
  );
  if (!owner) {
    // 起深落在分层空档：取到最近分层边界的距离
    let gap = Infinity;
    for (const layer of hole.layers) {
      gap = Math.min(
        gap,
        Math.abs(depthFrom - layer.top),
        Math.abs(depthFrom - layer.bottom),
      );
    }
    const rounded = Number(gap.toFixed(2));
    return issue(
      "DEPTH_MISMATCH",
      `起深 ${depthFrom}m 对不上任何分层界线（深度差约 ${rounded}m）`,
      rounded,
    );
  }

  if (depthTo <= owner.bottom + DEPTH_TOLERANCE) return null;

  const gap = Number((depthTo - owner.bottom).toFixed(2));
  return issue(
    "DEPTH_MISMATCH",
    `样段跨越 ${owner.bottom.toFixed(2)}m 分层界线进入「${
      hole.layers.find((layer) => layer.top === owner.bottom)?.lithology ?? "邻层"
    }」（跨层 ${gap}m）`,
    gap,
  );
}

/** 封样时刻判定：无效或距登记时刻超过两小时均进待复核 */
export function checkSealedAt(sealedAt: string, registeredAt: Date): Issue | null {
  const sealed = parseInputValue(sealedAt);
  if (!sealed) {
    return issue("SEAL_INVALID", "封样时刻缺失或无法识别");
  }
  const diffMinutes = (registeredAt.getTime() - sealed.getTime()) / 60_000;
  if (diffMinutes > SEAL_LIMIT_MINUTES) {
    return issue(
      "SEAL_TIMEOUT",
      `封样至登记已 ${Math.round(diffMinutes)} 分钟，超过 ${SEAL_LIMIT_MINUTES} 分钟（2 小时）`,
    );
  }
  return null;
}

/**
 * 执行全部现场判定，返回问题清单。空清单即现场合格，可进入待送检。
 * 数值字段无法解析时先报必填/格式问题，不再继续深度核对。
 */
export function validateDraft(
  draft: SampleDraft,
  ctx: ValidationContext,
): Issue[] {
  const issues: Issue[] = [];
  const registeredAt = ctx.registeredAt ?? new Date();
  const hole = ctx.boreholes.find((item) => item.holeId === draft.holeId);

  if (!draft.holeId) issues.push(issue("FIELD_REQUIRED", "未选择钻孔孔号"));
  if (!draft.runNo || !Number.isFinite(Number(draft.runNo)) || Number(draft.runNo) <= 0) {
    issues.push(issue("FIELD_REQUIRED", "回次缺失或不是正整数"));
  }
  if (!draft.sampleNo.trim()) {
    issues.push(issue("FIELD_REQUIRED", "样号缺失"));
  }
  if (!draft.samplerNo.trim()) {
    issues.push(issue("FIELD_REQUIRED", "取土器/标贯器编号缺失"));
  }

  const from = Number(draft.depthFrom);
  const to = Number(draft.depthTo);
  const depthsValid =
    draft.depthFrom.trim() !== "" &&
    draft.depthTo.trim() !== "" &&
    Number.isFinite(from) &&
    Number.isFinite(to);

  if (!depthsValid) {
    issues.push(issue("FIELD_REQUIRED", "起止深度缺失或不是数值"));
  } else if (from < 0 || to <= from) {
    issues.push(issue("DEPTH_ORDER", `深度顺序错误：起深 ${from}m 须小于止深 ${to}m`));
  } else if (!hole) {
    issues.push(issue("LAYER_MISSING", "该孔暂无分层编录资料，无法核对深度"));
  } else {
    const depthIssue = checkDepth(hole, from, to);
    if (depthIssue) issues.push(depthIssue);
  }

  const sealedIssue = checkSealedAt(draft.sealedAt, registeredAt);
  if (sealedIssue) issues.push(sealedIssue);

  if (draft.sampleNo.trim()) {
    const duplicated = ctx.activeRecords.find(
      (record) =>
        record.id !== ctx.selfId &&
        !record.supersededBy &&
        record.sampleNo.trim() === draft.sampleNo.trim(),
    );
    if (duplicated) {
      issues.push(
        issue(
          "DUPLICATE_NO",
          `样号重复：${draft.sampleNo} 已在 ${duplicated.holeId} 孔第 ${duplicated.runNo} 回次登记`,
        ),
      );
    }
  }

  return issues;
}
