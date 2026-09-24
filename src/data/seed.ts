// 资料层：本地既有资料（已编录分层）+ 首次打开时播种的历史样件。
// 沿用本地数据，不接后端、不加依赖。

import type {
  Borehole,
  LogEntry,
  SampleRecord,
  SampleStatus,
  SampleType,
} from "./types";

export const BOREHOLES: readonly Borehole[] = [
  {
    holeId: "ZK-18",
    totalDepth: 22.6,
    waterLevel: 3.4,
    layers: [
      { top: 0, bottom: 4.2, lithology: "杂填土" },
      { top: 4.2, bottom: 12.0, lithology: "粉质黏土（可塑）" },
      { top: 12.0, bottom: 18.6, lithology: "粉砂（中密）" },
      { top: 18.6, bottom: 22.6, lithology: "强风化泥岩" },
    ],
  },
  {
    holeId: "ZK-21",
    totalDepth: 31.2,
    waterLevel: 5.1,
    layers: [
      { top: 0, bottom: 3.0, lithology: "素填土" },
      { top: 3.0, bottom: 9.5, lithology: "粉质黏土（软塑）" },
      { top: 9.5, bottom: 17.0, lithology: "中粗砂（稍密）" },
      { top: 17.0, bottom: 25.8, lithology: "卵石层（稍密，夹中粗砂）" },
      { top: 25.8, bottom: 31.2, lithology: "强风化砂岩" },
    ],
  },
  {
    holeId: "ZK-24",
    totalDepth: 18.4,
    waterLevel: null,
    layers: [
      { top: 0, bottom: 2.6, lithology: "杂填土" },
      { top: 2.6, bottom: 8.0, lithology: "黏土（硬塑）" },
      { top: 8.0, bottom: 14.2, lithology: "粉质黏土（硬塑）" },
      { top: 14.2, bottom: 18.4, lithology: "强风化泥岩（芯样完整率62%）" },
    ],
  },
];

function log(at: string, text: string): LogEntry {
  return { at, text };
}

interface SeedSpec {
  id: string;
  holeId: string;
  runNo: number;
  sampleNo: string;
  depthFrom: number;
  depthTo: number;
  sampleType: SampleType;
  samplerNo: string;
  sealedAt: string;
  status: SampleStatus;
  declaredWeight?: number;
  receivedWeight?: number;
  sentAt?: string;
  receivedAt?: string;
  labReceived?: boolean;
  result?: string;
  qualified?: boolean;
  frozen?: boolean;
  version?: number;
  supersedesId?: string;
  supersededBy?: string;
  correctionReason?: string;
  returnReason?: string;
  logs: LogEntry[];
  createdAt: string;
}

/** 播种时间轴（均为过去时刻，首次打开当天计算，保证演示状态可复现） */
function seedTimeline(d: (minutesAgo: number) => string): SeedSpec[] {
  return [
    {
      id: "seed-s1",
      holeId: "ZK-18",
      runNo: 3,
      sampleNo: "Y-038",
      depthFrom: 5.0,
      depthTo: 5.2,
      sampleType: "原状样",
      samplerNo: "TY-07",
      sealedAt: d(40),
      status: "待送检",
      logs: [log(d(38), "现场登记，判定合格，进入待送检")],
      createdAt: d(38),
    },
    {
      id: "seed-s2",
      holeId: "ZK-18",
      runNo: 4,
      sampleNo: "Y-041",
      depthFrom: 10.8,
      depthTo: 12.35,
      sampleType: "原状样",
      samplerNo: "TY-07",
      sealedAt: d(210),
      status: "待复核",
      logs: [
        log(
          d(60),
          "登记入待复核：样段跨越 12.00m 分层界线进入「粉砂（中密）」（跨层 0.35m）；封样至登记已 150 分钟，超过 120 分钟（2 小时）",
        ),
      ],
      createdAt: d(60),
    },
    {
      id: "seed-s3",
      holeId: "ZK-18",
      runNo: 6,
      sampleNo: "N-012",
      depthFrom: 13.0,
      depthTo: 13.45,
      sampleType: "标贯",
      samplerNo: "BG-02",
      sealedAt: d(300),
      status: "待送检",
      logs: [log(d(296), "现场登记，判定合格，进入待送检")],
      createdAt: d(296),
    },
    {
      id: "seed-s4",
      holeId: "ZK-21",
      runNo: 5,
      sampleNo: "Y-040",
      depthFrom: 18.2,
      depthTo: 18.4,
      sampleType: "原状样",
      samplerNo: "TY-11",
      sealedAt: d(720),
      status: "已送检",
      declaredWeight: 1.42,
      sentAt: d(600),
      labReceived: false,
      logs: [
        log(d(718), "现场登记，判定合格，进入待送检"),
        log(d(600), "现场送检，申报重量 1.42kg"),
      ],
      createdAt: d(718),
    },
    {
      id: "seed-s5",
      holeId: "ZK-21",
      runNo: 7,
      sampleNo: "Y-039",
      depthFrom: 22.0,
      depthTo: 22.2,
      sampleType: "原状样",
      samplerNo: "TY-11",
      sealedAt: d(2880),
      status: "退回",
      declaredWeight: 1.38,
      sentAt: d(2820),
      returnReason: "少样：送检清单内样号未送达，实验室退回",
      logs: [
        log(d(2878), "现场登记，判定合格，进入待送检"),
        log(d(2820), "现场送检，申报重量 1.38kg"),
        log(d(1500), "实验室核对：少样，样号未送达，整批退回"),
      ],
      createdAt: d(2878),
    },
    {
      id: "seed-s6",
      holeId: "ZK-21",
      runNo: 2,
      sampleNo: "Y-032",
      depthFrom: 6.0,
      depthTo: 6.2,
      sampleType: "原状样",
      samplerNo: "TY-11",
      sealedAt: d(4320),
      status: "已入库",
      declaredWeight: 1.35,
      receivedWeight: 1.34,
      sentAt: d(4300),
      receivedAt: d(4000),
      labReceived: true,
      result: "含水率22.1%，孔隙比0.71，压缩系数0.24MPa⁻¹，合格",
      qualified: true,
      frozen: true,
      logs: [
        log(d(4318), "现场登记，判定合格，进入待送检"),
        log(d(4300), "现场送检，申报重量 1.35kg"),
        log(d(4000), "实验室核对：样号相符，实收 1.34kg，等待试验结果"),
        log(d(3800), "试验结果写入并冻结原记录：含水率22.1%，孔隙比0.71，压缩系数0.24MPa⁻¹，合格"),
      ],
      createdAt: d(4318),
    },
    {
      id: "seed-s7",
      holeId: "ZK-24",
      runNo: 2,
      sampleNo: "Y-034",
      depthFrom: 4.5,
      depthTo: 4.7,
      sampleType: "原状样",
      samplerNo: "TY-03",
      sealedAt: d(4320),
      status: "已入库",
      declaredWeight: 1.4,
      receivedWeight: 1.39,
      sentAt: d(4300),
      receivedAt: d(4000),
      labReceived: true,
      result: "含水率20.8%，原记录已更正替代",
      qualified: true,
      frozen: true,
      supersededBy: "seed-s9",
      logs: [
        log(d(4318), "现场登记，判定合格，进入待送检"),
        log(d(4300), "现场送检，申报重量 1.40kg"),
        log(d(4000), "实验室核对：样号相符，实收 1.39kg，等待试验结果"),
        log(d(3800), "试验结果写入并冻结原记录：含水率20.8%"),
        log(
          d(1200),
          "现场更正：由新版本 v2 替代，原因：深度记录笔误，4.0–4.2 应为 4.5–4.7；原记录冻结留档",
        ),
      ],
      createdAt: d(4318),
    },
    {
      id: "seed-s8",
      holeId: "ZK-24",
      runNo: 4,
      sampleNo: "Y-041",
      depthFrom: 9.0,
      depthTo: 9.2,
      sampleType: "扰动样",
      samplerNo: "RD-05",
      sealedAt: d(90),
      status: "待复核",
      logs: [
        log(
          d(85),
          "登记入待复核：样号重复：Y-041 已在 ZK-18 孔第 4 回次登记",
        ),
      ],
      createdAt: d(85),
    },
    {
      id: "seed-s9",
      holeId: "ZK-24",
      runNo: 2,
      sampleNo: "Y-034-1",
      depthFrom: 4.5,
      depthTo: 4.7,
      sampleType: "原状样",
      samplerNo: "TY-03",
      sealedAt: d(4320),
      status: "已入库",
      declaredWeight: 1.4,
      receivedWeight: 1.39,
      sentAt: d(1100),
      receivedAt: d(1000),
      labReceived: true,
      result: "含水率20.6%，液性指数0.31，合格",
      qualified: true,
      frozen: true,
      version: 2,
      supersedesId: "seed-s7",
      correctionReason: "深度记录笔误，4.0–4.2 应为 4.5–4.7",
      logs: [
        log(
          d(1200),
          "现场更正自 Y-034（v1，ZK-24）；原因：深度记录笔误，4.0–4.2 应为 4.5–4.7",
        ),
        log(d(1200), "新版本判定合格，进入待送检"),
        log(d(1100), "现场送检，申报重量 1.40kg"),
        log(d(1000), "实验室核对：样号相符，实收 1.39kg，等待试验结果"),
        log(d(900), "试验结果写入并冻结原记录：含水率20.6%，液性指数0.31，合格"),
      ],
      createdAt: d(1200),
    },
  ];
}

function hydrate(spec: SeedSpec): SampleRecord {
  return {
    id: spec.id,
    holeId: spec.holeId,
    runNo: spec.runNo,
    sampleNo: spec.sampleNo,
    depthFrom: spec.depthFrom,
    depthTo: spec.depthTo,
    sampleType: spec.sampleType,
    samplerNo: spec.samplerNo,
    sealedAt: spec.sealedAt,
    status: spec.status,
    issues: [],
    declaredWeight: spec.declaredWeight ?? null,
    receivedWeight: spec.receivedWeight ?? null,
    sentAt: spec.sentAt ?? null,
    receivedAt: spec.receivedAt ?? null,
    labReceived: spec.labReceived ?? false,
    result: spec.result ?? "",
    qualified: spec.qualified ?? false,
    frozen: spec.frozen ?? false,
    version: spec.version ?? 1,
    supersedesId: spec.supersedesId ?? null,
    supersededBy: spec.supersededBy ?? null,
    correctionReason: spec.correctionReason ?? "",
    returnReason: spec.returnReason ?? "",
    log: spec.logs,
    createdAt: spec.createdAt,
    updatedAt: spec.logs[spec.logs.length - 1].at,
  };
}

export function buildSeedSamples(): SampleRecord[] {
  const minutesAgo = (minutes: number) => {
    const date = new Date(Date.now() - minutes * 60_000);
    const pad = (value: number) => String(value).padStart(2, "0");
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
  };
  const records = seedTimeline(minutesAgo).map(hydrate);

  // 待复核样件的问题快照按播种时刻重建，保证消息与数据一致
  const s2 = records.find((item) => item.id === "seed-s2");
  if (s2) {
    s2.issues = [
      {
        code: "DEPTH_MISMATCH",
        message:
          "样段跨越 12.00m 分层界线进入「粉砂（中密）」（跨层 0.35m）",
        depthGap: 0.35,
      },
      {
        code: "SEAL_TIMEOUT",
        message: "封样至登记已 150 分钟，超过 120 分钟（2 小时）",
      },
    ];
  }
  const s8 = records.find((item) => item.id === "seed-s8");
  if (s8) {
    s8.issues = [
      {
        code: "DUPLICATE_NO",
        message: "样号重复：Y-041 已在 ZK-18 孔第 4 回次登记",
      },
    ];
  }
  return records;
}
