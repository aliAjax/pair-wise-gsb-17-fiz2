// 资料层：初始编录资料（孔、分层）与示例样品记录

import type { AppState, Hole, Layer, SampleRecord, SampleStatus, SampleType, SampleVersion, LabInfo } from "../types";
import { validateSample } from "../rules";

const holes: Hole[] = [
  { id: "ZK-18", depth: 22.6, waterLevel: 3.4 },
  { id: "ZK-21", depth: 31.2, waterLevel: 5.1 },
  { id: "ZK-24", depth: 18.4 },
];

const layers: Layer[] = [
  { id: "L18-1", holeId: "ZK-18", top: 0, bottom: 3.5, soil: "杂填土", desc: "松散，含砖渣" },
  { id: "L18-2", holeId: "ZK-18", top: 3.5, bottom: 9.8, soil: "粉质黏土", desc: "可塑，中压缩性" },
  { id: "L18-3", holeId: "ZK-18", top: 9.8, bottom: 15.2, soil: "粉砂", desc: "稍密，饱和" },
  { id: "L18-4", holeId: "ZK-18", top: 15.2, bottom: 22.6, soil: "强风化泥岩", desc: "芯样完整率62%" },
  { id: "L21-1", holeId: "ZK-21", top: 0, bottom: 4.0, soil: "素填土", desc: "松散" },
  { id: "L21-2", holeId: "ZK-21", top: 4.0, bottom: 12.5, soil: "淤泥质黏土", desc: "流塑~软塑" },
  { id: "L21-3", holeId: "ZK-21", top: 12.5, bottom: 20.0, soil: "中粗砂", desc: "中密" },
  { id: "L21-4", holeId: "ZK-21", top: 20.0, bottom: 31.2, soil: "卵石", desc: "稍密，夹中粗砂" },
  { id: "L24-1", holeId: "ZK-24", top: 0, bottom: 2.8, soil: "杂填土", desc: "松散" },
  { id: "L24-2", holeId: "ZK-24", top: 2.8, bottom: 10.6, soil: "黏土", desc: "硬塑" },
  { id: "L24-3", holeId: "ZK-24", top: 10.6, bottom: 18.4, soil: "强风化泥岩", desc: "岩芯破碎" },
];

function ver(
  version: number,
  time: string,
  reason: string,
  sampleType: SampleType,
  top: number,
  bottom: number,
  samplerId: string,
  sampledAt: string,
  sealedAt: string
): SampleVersion {
  return { version, time, operator: "编录员·李工", reason, sampleType, top, bottom, samplerId, sampledAt, sealedAt };
}

function rec(
  id: string,
  holeId: string,
  runNo: number,
  sampleNo: string,
  status: SampleStatus,
  versions: SampleVersion[],
  lab?: LabInfo
): SampleRecord {
  return { id, holeId, runNo, sampleNo, status, issues: [], versions, lab };
}

function buildRecords(): SampleRecord[] {
  return [
    // 已送检：深度落在粉质黏土层内，封样 50 分钟；v1 封样时刻笔误，v2 更正
    rec("S1", "ZK-18", 3, "ZK18-003", "sent", [
      ver(1, "2026-09-23T09:20", "初始登记", "原状样", 4.0, 4.5, "TQ-07", "2026-09-23T08:10", "2026-09-23T11:40"),
      ver(2, "2026-09-23T10:05", "封样时刻笔误，实际 09:00 封样", "原状样", 4.0, 4.5, "TQ-07", "2026-09-23T08:10", "2026-09-23T09:00"),
    ]),
    // 待复核：9.5~10.1m 跨越粉质黏土/粉砂层界 9.8m
    rec("S2", "ZK-18", 5, "ZK18-005", "sent", [
      ver(1, "2026-09-23T11:30", "初始登记", "原状样", 9.5, 10.1, "TQ-07", "2026-09-23T10:50", "2026-09-23T11:20"),
    ]),
    // 待复核：样号与 S1 重复
    rec("S3", "ZK-18", 6, "ZK18-003", "sent", [
      ver(1, "2026-09-23T13:10", "初始登记", "扰动样", 11.0, 11.5, "TQ-12", "2026-09-23T12:30", "2026-09-23T13:00"),
    ]),
    // 待复核：取样至封样 2.6h，超过两小时
    rec("S4", "ZK-21", 2, "ZK21-002", "sent", [
      ver(1, "2026-09-23T13:00", "初始登记", "扰动样", 6.0, 6.5, "TQ-03", "2026-09-23T10:05", "2026-09-23T12:40"),
    ]),
    // 已送检
    rec("S5", "ZK-21", 4, "ZK21-004", "sent", [
      ver(1, "2026-09-23T15:20", "初始登记", "原状样", 13.0, 13.5, "TQ-05", "2026-09-23T14:40", "2026-09-23T15:10"),
    ]),
    // 已入库：实验室结果已回填，原记录冻结
    rec("S6", "ZK-24", 3, "ZK24-003", "archived", [
      ver(1, "2026-09-22T16:00", "初始登记", "原状样", 5.2, 5.7, "TQ-02", "2026-09-22T15:00", "2026-09-22T15:40"),
    ], {
      receivedAt: "2026-09-23T09:10",
      weight: 846,
      result: "含水率28.4%，液限36.2%，塑限19.8%，合格",
    }),
    // 已退回：实验室按清单核对少 1 件
    rec("S7", "ZK-24", 4, "ZK24-004", "returned", [
      ver(1, "2026-09-22T17:10", "初始登记", "扰动样", 12.0, 12.5, "TQ-09", "2026-09-22T16:20", "2026-09-22T16:50"),
    ], {
      returnedReason: "实验室按送样清单核对少1件（该样未见），退回补送",
    }),
  ];
}

export function seedState(): AppState {
  const records = buildRecords();
  const checked = records.map((r) => {
    const issues = validateSample(r, records.filter((o) => o.id !== r.id), layers, holes);
    // 有问题的留待复核，其余保留既定状态
    return { ...r, issues, status: issues.length > 0 ? ("pending" as const) : r.status };
  });
  return { holes, layers, records: checked };
}
