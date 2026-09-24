// 资料层：领域类型定义，不包含任何判定逻辑与存储逻辑

/** 样型：原状样、扰动样、标贯、岩芯样 */
export type SampleType = "原状样" | "扰动样" | "标贯" | "岩芯样";

export const SAMPLE_TYPES: readonly SampleType[] = [
  "原状样",
  "扰动样",
  "标贯",
  "岩芯样",
];

/** 样件台账状态 */
export type SampleStatus = "待复核" | "待送检" | "已送检" | "已入库" | "退回";

export const SAMPLE_STATUSES: readonly SampleStatus[] = [
  "待复核",
  "待送检",
  "已送检",
  "已入库",
  "退回",
];

/** 已编录分层（钻孔编录的既有成果，作为深度核对依据） */
export interface Layer {
  readonly top: number; // 层顶深度 m
  readonly bottom: number; // 层底深度 m
  readonly lithology: string; // 岩性描述
}

export interface Borehole {
  readonly holeId: string; // 孔号
  readonly totalDepth: number; // 累计孔深 m
  readonly waterLevel: number | null; // 地下水位 m
  readonly layers: Layer[];
}

/** 判定问题代码 */
export type IssueCode =
  | "FIELD_REQUIRED"
  | "LAYER_MISSING"
  | "DEPTH_ORDER"
  | "DEPTH_MISMATCH"
  | "DUPLICATE_NO"
  | "SEAL_TIMEOUT"
  | "SEAL_INVALID";

export interface Issue {
  readonly code: IssueCode;
  readonly message: string;
  /** 深度差 m：样段与分层底板/孔深的超出量，可被检索 */
  readonly depthGap?: number;
}

export interface LogEntry {
  readonly at: string;
  readonly text: string;
}

/** 一条取样/试验跟踪记录 */
export interface SampleRecord {
  id: string;
  holeId: string; // 孔号
  runNo: number; // 回次
  sampleNo: string; // 样号
  depthFrom: number; // 起深 m
  depthTo: number; // 止深 m
  sampleType: SampleType; // 样型
  samplerNo: string; // 取土器（标贯器）编号
  sealedAt: string; // 封样时刻（本地时间 yyyy-MM-ddTHH:mm）

  status: SampleStatus;
  issues: Issue[]; // 最近一次判定快照

  // 送检 / 实验室核对
  declaredWeight: number | null; // 送样申报重量 kg
  receivedWeight: number | null; // 实验室实收重量 kg
  sentAt: string | null;
  receivedAt: string | null;
  labReceived: boolean; // 实验室已核对无误

  // 试验结果
  result: string;
  qualified: boolean;

  // 冻结与版本
  frozen: boolean;
  version: number;
  supersedesId: string | null; // 本版本更正自哪条记录
  supersededBy: string | null; // 本记录已被哪个新版本替代
  correctionReason: string; // 现场更正原因
  returnReason: string; // 退回原因（少样 / 重量不足 / 不合格）

  log: LogEntry[];
  createdAt: string;
  updatedAt: string;
}

/** 登记表单提交内容（深度等在判定层解析） */
export interface SampleDraft {
  holeId: string;
  runNo: string;
  sampleNo: string;
  depthFrom: string;
  depthTo: string;
  sampleType: SampleType;
  samplerNo: string;
  sealedAt: string;
}
