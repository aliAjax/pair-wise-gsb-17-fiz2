// 资料层：领域模型

export type SampleType = "原状样" | "扰动样" | "岩芯样" | "标贯样";
export const SAMPLE_TYPES: SampleType[] = ["原状样", "扰动样", "岩芯样", "标贯样"];

/** pending 待复核 / sent 已送检 / archived 已入库 / returned 已退回 */
export type SampleStatus = "pending" | "sent" | "archived" | "returned";

export const STATUS_LABEL: Record<SampleStatus, string> = {
  pending: "待复核",
  sent: "已送检",
  archived: "已入库",
  returned: "已退回",
};

export const STATUS_ORDER: SampleStatus[] = ["pending", "sent", "archived", "returned"];

export interface Hole {
  id: string; // 孔号，如 ZK-18
  depth: number; // 已编录孔深 m
  waterLevel?: number; // 地下水位 m
}

export interface Layer {
  id: string;
  holeId: string;
  top: number; // 层顶深度 m
  bottom: number; // 层底深度 m
  soil: string; // 岩性
  desc: string;
}

/** 样品记录的一个版本：初始登记或一次带原因的现场更正 */
export interface SampleVersion {
  version: number;
  time: string; // 版本登记时刻，本地 "YYYY-MM-DDTHH:mm"
  operator: string;
  reason: string; // 初始登记 / 更正原因
  sampleType: SampleType;
  top: number; // 取样起深度 m
  bottom: number; // 取样止深度 m
  samplerId: string; // 取土器编号
  sampledAt: string; // 取样时刻
  sealedAt: string; // 封样时刻
}

/** 实验室接收与结果回填 */
export interface LabInfo {
  receivedAt?: string;
  weight?: number; // 实收重量 g
  result?: string; // 试验结果摘要
  returnedReason?: string; // 退回原因（如少样）
}

export interface SampleRecord {
  id: string;
  holeId: string;
  runNo: number; // 回次
  sampleNo: string; // 样号
  status: SampleStatus;
  issues: string[]; // 当前版本的复核问题（含深度差）
  versions: SampleVersion[]; // 最后一个为当前版本；入库后原版本冻结
  lab?: LabInfo;
}

export interface AppState {
  holes: Hole[];
  layers: Layer[];
  records: SampleRecord[];
}

/** 登记/更正表单共用的取值 */
export interface SampleFormValues {
  holeId: string;
  runNo: number;
  sampleNo: string;
  sampleType: SampleType;
  top: number;
  bottom: number;
  samplerId: string;
  sampledAt: string;
  sealedAt: string;
}
