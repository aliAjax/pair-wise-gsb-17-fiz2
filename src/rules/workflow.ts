// 判定层：台账状态流转
// 登记/更正 -> 判定 -> 待复核 | 待送检
// 送检 -> 已送检；实验室核对样号与重量 -> 少样退回
// 合格结果写入 -> 已入库并冻结原记录；现场更正 -> 另建带原因的新版本

import type {
  Borehole,
  Issue,
  LogEntry,
  SampleDraft,
  SampleRecord,
  SampleStatus,
  SampleType,
} from "../data/types";
import { nowInputValue } from "../data/time";
import { validateDraft, type ValidationContext } from "./validate";

let sequence = 0;
export function nextId(): string {
  sequence += 1;
  const rand = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, "0");
  return `s-${Date.now().toString(36)}-${sequence}-${rand}`;
}

export function draftFromRecord(record: SampleRecord): SampleDraft {
  return {
    holeId: record.holeId,
    runNo: String(record.runNo),
    sampleNo: record.sampleNo,
    depthFrom: String(record.depthFrom),
    depthTo: String(record.depthTo),
    sampleType: record.sampleType,
    samplerNo: record.samplerNo,
    sealedAt: record.sealedAt,
  };
}

function logEntry(text: string): LogEntry {
  return { at: nowInputValue(), text };
}

/** 更正/重新送检后清空实验室环节字段 */
function resetLabFields(record: SampleRecord): void {
  record.declaredWeight = null;
  record.receivedWeight = null;
  record.sentAt = null;
  record.receivedAt = null;
  record.labReceived = false;
  record.result = "";
  record.qualified = false;
  record.frozen = false;
  record.returnReason = "";
}

function statusFromIssues(issues: readonly Issue[]): SampleStatus {
  return issues.length > 0 ? "待复核" : "待送检";
}

/** 现场登记：按回次登记样件并立即判定 */
export function registerSample(
  draft: SampleDraft,
  ctx: ValidationContext,
): SampleRecord {
  const issues = validateDraft(draft, ctx);
  const timestamp = nowInputValue();
  const record: SampleRecord = {
    id: nextId(),
    holeId: draft.holeId,
    runNo: Number(draft.runNo),
    sampleNo: draft.sampleNo.trim(),
    depthFrom: Number(draft.depthFrom),
    depthTo: Number(draft.depthTo),
    sampleType: draft.sampleType as SampleType,
    samplerNo: draft.samplerNo.trim(),
    sealedAt: draft.sealedAt,
    status: statusFromIssues(issues),
    issues,
    declaredWeight: null,
    receivedWeight: null,
    sentAt: null,
    receivedAt: null,
    labReceived: false,
    result: "",
    qualified: false,
    frozen: false,
    version: 1,
    supersedesId: null,
    supersededBy: null,
    correctionReason: "",
    returnReason: "",
    log: [
      logEntry(
        issues.length > 0
          ? `登记入待复核：${issues.map((item) => item.message).join("；")}`
          : "现场登记，判定合格，进入待送检",
      ),
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return record;
}

/** 复核修改（限未冻结记录），修改后重新判定 */
export function reviseSample(
  records: SampleRecord[],
  id: string,
  draft: SampleDraft,
  ctx: ValidationContext,
): SampleRecord[] {
  const target = records.find((item) => item.id === id);
  if (!target) throw new Error("记录不存在");
  if (target.frozen) throw new Error("记录已冻结并入库，不能直接修改，请走现场更正另建版本");

  const issues = validateDraft(draft, { ...ctx, selfId: id });
  const next: SampleRecord = {
    ...target,
    holeId: draft.holeId,
    runNo: Number(draft.runNo),
    sampleNo: draft.sampleNo.trim(),
    depthFrom: Number(draft.depthFrom),
    depthTo: Number(draft.depthTo),
    sampleType: draft.sampleType as SampleType,
    samplerNo: draft.samplerNo.trim(),
    sealedAt: draft.sealedAt,
    issues,
    status: statusFromIssues(issues),
    updatedAt: nowInputValue(),
    log: [
      ...target.log,
      logEntry(
        `现场复核修改，重新判定：${
          issues.length > 0
            ? issues.map((item) => item.message).join("；")
            : "问题已排除，转入待送检"
        }`,
      ),
    ],
  };
  // 复核修改后实验室环节重新走一遍
  resetLabFields(next);
  return records.map((item) => (item.id === id ? next : item));
}

/** 删除：冻结记录不允许删除 */
export function deleteSample(records: SampleRecord[], id: string): SampleRecord[] {
  const target = records.find((item) => item.id === id);
  if (!target) return records;
  if (target.frozen) throw new Error("已冻结入库的记录不能删除");
  return records.filter((item) => item.id !== id);
}

/** 送检：仅待送检（现场判定合格）的样件可送，登记申报重量 */
export function sendSamples(
  records: SampleRecord[],
  ids: readonly string[],
  declaredWeights: Readonly<Record<string, number>>,
): SampleRecord[] {
  const timestamp = nowInputValue();
  return records.map((record) => {
    if (!ids.includes(record.id)) return record;
    if (record.status !== "待送检") {
      throw new Error(`${record.sampleNo} 当前为「${record.status}」，不能送检`);
    }
    const weight = declaredWeights[record.id];
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new Error(`${record.sampleNo} 缺少有效的送样重量`);
    }
    return {
      ...record,
      status: "已送检" as SampleStatus,
      declaredWeight: Number(weight.toFixed(2)),
      receivedWeight: null,
      receivedAt: null,
      labReceived: false,
      returnReason: "",
      sentAt: timestamp,
      updatedAt: timestamp,
      log: [...record.log, logEntry(`现场送检，申报重量 ${weight.toFixed(2)}kg`)],
    };
  });
}

/** 实验室核对：按送样清单点样号、核重量；少样（清单内未到）即退回 */
export function receiveSamples(
  records: SampleRecord[],
  payload: {
    /** 本次随样送到（样号核对无误）的记录 id */
    arrivedIds: readonly string[];
    /** 实收重量 kg；缺键或 <=0 视为重量核对不合格 */
    receivedWeights: Readonly<Record<string, number>>;
    /** 重量容差 kg，默认 0.05kg */
    tolerance?: number;
  },
): SampleRecord[] {
  const tolerance = payload.tolerance ?? 0.05;
  const timestamp = nowInputValue();

  return records.map((record) => {
    if (record.status !== "已送检" || record.labReceived) return record;

    // 样号点不到：少样退回
    if (!payload.arrivedIds.includes(record.id)) {
      return {
        ...record,
        status: "退回" as SampleStatus,
        returnReason: "少样：送检清单内样号未送达，实验室退回",
        updatedAt: timestamp,
        log: [
          ...record.log,
          logEntry("实验室核对：少样，样号未送达，整批退回"),
        ],
      };
    }

    const weight = payload.receivedWeights[record.id];
    if (!Number.isFinite(weight) || weight <= 0) {
      return {
        ...record,
        status: "退回" as SampleStatus,
        returnReason: "重量核对失败：未记录实收重量",
        updatedAt: timestamp,
        log: [...record.log, logEntry("实验室核对：缺少实收重量记录，退回")],
      };
    }

    const rounded = Number(weight.toFixed(2));
    const declared = record.declaredWeight ?? 0;
    if (rounded + tolerance < declared) {
      return {
        ...record,
        receivedWeight: rounded,
        receivedAt: timestamp,
        status: "退回" as SampleStatus,
        returnReason: `重量不足：申报 ${declared.toFixed(
          2,
        )}kg，实收 ${rounded.toFixed(2)}kg，差 ${(declared - rounded).toFixed(2)}kg`,
        updatedAt: timestamp,
        log: [
          ...record.log,
          logEntry(
            `实验室核对：实收 ${rounded.toFixed(2)}kg 少于申报 ${declared.toFixed(
              2,
            )}kg，退回`,
          ),
        ],
      };
    }

    return {
      ...record,
      receivedWeight: rounded,
      receivedAt: timestamp,
      labReceived: true,
      updatedAt: timestamp,
      log: [
        ...record.log,
        logEntry(
          `实验室核对：样号相符，实收 ${rounded.toFixed(2)}kg，等待试验结果`,
        ),
      ],
    };
  });
}

/** 写入试验结果：合格则写入并冻结原记录、标记已入库；不合格退回 */
export function writeResult(
  records: SampleRecord[],
  id: string,
  result: string,
  qualified: boolean,
): SampleRecord[] {
  const target = records.find((item) => item.id === id);
  if (!target) throw new Error("记录不存在");
  if (!target.labReceived) throw new Error("实验室尚未核对收货，不能写入结果");
  if (target.frozen) throw new Error("结果已冻结入库");
  const text = result.trim();
  if (!text) throw new Error("试验结果内容为空");

  const timestamp = nowInputValue();
  return records.map((record) => {
    if (record.id !== id) return record;
    if (qualified) {
      return {
        ...record,
        result: text,
        qualified: true,
        status: "已入库" as SampleStatus,
        frozen: true,
        updatedAt: timestamp,
        log: [...record.log, logEntry(`试验结果写入并冻结原记录：${text}`)],
      };
    }
    return {
      ...record,
      result: text,
      qualified: false,
      status: "退回" as SampleStatus,
      returnReason: `试验结果不合格：${text}`,
      updatedAt: timestamp,
      log: [...record.log, logEntry(`试验结果不合格，退回现场：${text}`)],
    };
  });
}

/**
 * 现场更正（冻结/退回记录均可）：原记录保留并标记被替代，
 * 另建带原因的新版本，按当前分层重新判定。
 */
export function correctSample(
  records: SampleRecord[],
  id: string,
  draft: SampleDraft,
  reason: string,
  ctx: ValidationContext,
): SampleRecord[] {
  const original = records.find((item) => item.id === id);
  if (!original) throw new Error("记录不存在");
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error("现场更正必须填写原因");

  // 原记录即将被新版本替代，查重时按“自己”排除，避免新样号与旧版本互撞
  const issues = validateDraft(draft, { ...ctx, selfId: id });
  const timestamp = nowInputValue();
  const newVersion: SampleRecord = {
    ...original,
    id: nextId(),
    holeId: draft.holeId,
    runNo: Number(draft.runNo),
    sampleNo: draft.sampleNo.trim(),
    depthFrom: Number(draft.depthFrom),
    depthTo: Number(draft.depthTo),
    sampleType: draft.sampleType as SampleType,
    samplerNo: draft.samplerNo.trim(),
    sealedAt: draft.sealedAt,
    issues,
    status: statusFromIssues(issues),
    declaredWeight: null,
    receivedWeight: null,
    sentAt: null,
    receivedAt: null,
    labReceived: false,
    result: "",
    qualified: false,
    frozen: false,
    version: original.version + 1,
    supersedesId: original.id,
    supersededBy: null,
    correctionReason: trimmedReason,
    returnReason: "",
    log: [
      logEntry(
        `现场更正自 ${original.sampleNo}（v${original.version}，${original.holeId}）；原因：${trimmedReason}`,
      ),
      logEntry(
        issues.length > 0
          ? `新版本判定待复核：${issues.map((item) => item.message).join("；")}`
          : "新版本判定合格，进入待送检",
      ),
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const superseded: SampleRecord = {
    ...original,
    supersededBy: newVersion.id,
    updatedAt: timestamp,
    log: [
      ...original.log,
      logEntry(
        `现场更正：由新版本 v${newVersion.version} 替代，原因：${trimmedReason}；原记录冻结留档`,
      ),
    ],
  };

  return [
    ...records.map((item) => (item.id === id ? superseded : item)),
    newVersion,
  ];
}
