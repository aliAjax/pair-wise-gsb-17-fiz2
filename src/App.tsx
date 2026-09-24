import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type {
  Borehole,
  SampleDraft,
  SampleRecord,
  SampleStatus,
} from "./data/types";
import { loadTracker, resetTracker, saveTracker } from "./storage/trackerStore";
import {
  correctSample,
  deleteSample,
  draftFromRecord,
  receiveSamples,
  registerSample,
  reviseSample,
  sendSamples,
  writeResult,
} from "./rules/workflow";
import SampleForm from "./components/SampleForm";
import Tracker, { type TrackerFilters } from "./components/Tracker";
import { ReceiveDialog, ResultDialog, SendDialog } from "./components/LabDialogs";
import Modal from "./components/Modal";

type DialogState =
  | { kind: "none" }
  | { kind: "edit"; record: SampleRecord }
  | { kind: "correct"; record: SampleRecord }
  | { kind: "result"; record: SampleRecord }
  | { kind: "send" }
  | { kind: "receive"; ids: string[] };

const PROJECT = {
  id: "hxwl-03",
  port: 5103,
  title: "岩土钻孔取样与试验跟踪台",
  subtitle:
    "按孔按回次登记原状样、扰动样与标贯：现场自动核对分层深度、样号重复与封样时刻；实验室点样号核重量；合格结果写入即冻结，现场更正另建带原因版本。",
  stack: "React + Vite + TypeScript + CSS（资料 / 判定 / 保存 / 界面分层，本地数据，无新增依赖）",
};

function MetricCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "teal" | "amber" | "blue" | "green" | "rose";
  hint: string;
}) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={`metric-bar tone-${tone}`} />
      <p className="metric-hint">{hint}</p>
    </article>
  );
}

function LayerReference({ boreholes }: { boreholes: readonly Borehole[] }) {
  return (
    <aside className="panel narrow">
      <h2>已编录分层</h2>
      <p className="aside-note">深度核对依据 · 深度落在同一层内（容差 0.05m）方为合格</p>
      <div className="borehole-list">
        {boreholes.map((hole) => (
          <div key={hole.holeId} className="borehole-card">
            <div className="borehole-head">
              <strong>{hole.holeId}</strong>
              <span>孔深 {hole.totalDepth}m</span>
            </div>
            <p className="water-line">
              {hole.waterLevel === null
                ? "未见地下水位"
                : `地下水位 ${hole.waterLevel.toFixed(1)}m`}
            </p>
            <ul className="layer-list">
              {hole.layers.map((layer) => (
                <li key={layer.top}>
                  <span className="layer-range mono">
                    {layer.top.toFixed(1)}–{layer.bottom.toFixed(1)}m
                  </span>
                  <span className="layer-name">{layer.lithology}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}

function App() {
  const initial = useMemo(loadTracker, []);
  const [boreholes] = useState<readonly Borehole[]>(initial.boreholes);
  const [records, setRecords] = useState<SampleRecord[]>(initial.samples);
  const [banner, setBanner] = useState<string | null>(
    initial.seeded ? "首次打开：已载入本地钻孔分层与历史样件示例数据。" : null,
  );
  const [formKey, setFormKey] = useState(0);
  const [filters, setFilters] = useState<TrackerFilters>({
    tab: "全部",
    query: "",
    holeId: "",
    maxGap: "",
  });
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });

  useEffect(() => {
    saveTracker(records);
  }, [records]);

  const validationContext = useMemo(
    () => ({ boreholes, activeRecords: records }),
    [boreholes, records],
  );

  const activeRecords = useMemo(
    () => records.filter((record) => !record.supersededBy),
    [records],
  );

  const counts = useMemo(() => {
    const byStatus = (status: SampleStatus) =>
      activeRecords.filter((record) => record.status === status).length;
    const frozen = activeRecords.filter((record) => record.frozen).length;
    return {
      review: byStatus("待复核"),
      waiting: byStatus("待送检"),
      sent: byStatus("已送检"),
      archived: frozen,
      returned: byStatus("退回"),
    };
  }, [activeRecords]);

  const showBanner = (text: string) => {
    setBanner(text);
    window.setTimeout(() => setBanner(null), 4000);
  };

  /* ---------- 现场登记 / 复核修改 / 现场更正 ---------- */

  const handleRegister = (draft: SampleDraft): string | null => {
    try {
      const record = registerSample(draft, validationContext);
      setRecords((prev) => [...prev, record]);
      setFormKey((key) => key + 1);
      if (record.issues.length > 0) {
        showBanner(`样件 ${record.sampleNo} 已登记，存在 ${record.issues.length} 项问题，留在待复核。`);
      } else {
        showBanner(`样件 ${record.sampleNo} 登记合格，进入待送检。`);
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "登记失败";
    }
  };

  const handleRevise = (draft: SampleDraft): string | null => {
    if (dialog.kind !== "edit") return "状态错误";
    try {
      const next = reviseSample(records, dialog.record.id, draft, validationContext);
      setRecords(next);
      setDialog({ kind: "none" });
      showBanner(`样件 ${draft.sampleNo} 已重新判定并保存。`);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "保存失败";
    }
  };

  const handleCorrect = (draft: SampleDraft, reason: string): string | null => {
    if (dialog.kind !== "correct") return "状态错误";
    try {
      const next = correctSample(
        records,
        dialog.record.id,
        draft,
        reason,
        validationContext,
      );
      setRecords(next);
      setDialog({ kind: "none" });
      showBanner(`已基于 ${dialog.record.sampleNo} 另建带原因的新版本，原记录留档冻结。`);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "更正失败";
    }
  };

  const handleDelete = (record: SampleRecord) => {
    if (record.frozen) {
      showBanner("已冻结入库的记录不能删除；如需更正请使用「现场更正」。");
      return;
    }
    if (!window.confirm(`确认删除样件 ${record.sampleNo}（${record.holeId} 第${record.runNo}回次）？`)) return;
    try {
      setRecords((prev) => deleteSample(prev, record.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
      showBanner(`样件 ${record.sampleNo} 已删除。`);
    } catch (error) {
      showBanner(error instanceof Error ? error.message : "删除失败");
    }
  };

  /* ---------- 送检 / 实验室收样 / 结果 ---------- */

  const selectedRecords = useMemo(
    () =>
      records.filter(
        (record) => selectedIds.has(record.id) && record.status === "待送检",
      ),
    [records, selectedIds],
  );

  const pendingReceiveRecords = useMemo(
    () =>
      records.filter(
        (record) => record.status === "已送检" && !record.labReceived && !record.supersededBy,
      ),
    [records],
  );

  const confirmSend = (weights: Record<string, number>): string | null => {
    try {
      setRecords((prev) => sendSamples(prev, [...selectedIds], weights));
      setSelectedIds(new Set());
      setDialog({ kind: "none" });
      showBanner("送检登记完成，状态转为已送检，等待实验室核对。");
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "送检失败";
    }
  };

  const confirmReceive = (
    arrivedIds: string[],
    receivedWeights: Record<string, number>,
  ): string | null => {
    if (dialog.kind !== "receive") return "状态错误";
    try {
      const next = receiveSamples(records, { arrivedIds, receivedWeights });
      setRecords(next);
      setDialog({ kind: "none" });
      const returned = dialog.ids.filter((id) => !arrivedIds.includes(id)).length;
      showBanner(
        returned > 0
          ? `收样核对完成：到样 ${arrivedIds.length} 件，少样 ${returned} 件已退回。`
          : `收样核对完成：${arrivedIds.length} 件样号、重量相符，等待结果。`,
      );
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "核对失败";
    }
  };

  const confirmResult = (result: string, qualified: boolean): string | null => {
    if (dialog.kind !== "result") return "状态错误";
    try {
      setRecords((prev) => writeResult(prev, dialog.record.id, result, qualified));
      setDialog({ kind: "none" });
      showBanner(
        qualified
          ? "合格结果已写入，原记录冻结，样件状态为已入库。"
          : "不合格已登记，样件退回现场。",
      );
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "结果写入失败";
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (ids: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const handleReset = () => {
    if (!window.confirm("恢复本地示例数据？当前台账将被覆盖（仅影响本机浏览器存储）。")) return;
    setRecords(resetTracker());
    setSelectedIds(new Set());
    setDialog({ kind: "none" });
    showBanner("已恢复本地示例数据。");
  };

  return (
    <main className="app-shell">
      {banner && (
        <div className="app-banner" role="status">
          {banner}
          <button type="button" onClick={() => setBanner(null)} aria-label="关闭提示">×</button>
        </div>
      )}

      <section className="hero">
        <div>
          <p className="eyebrow">{PROJECT.id} · port {PROJECT.port}</p>
          <h1>{PROJECT.title}</h1>
          <p className="subtitle">{PROJECT.subtitle}</p>
        </div>
        <div className="stack-card">
          <span>架构</span>
          <strong>{PROJECT.stack}</strong>
          <span className="storage-note">数据保存于本机 localStorage，重开页面状态保留。</span>
          <button type="button" className="reset-button" onClick={handleReset}>
            恢复本地示例数据
          </button>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="待复核" value={counts.review} tone="amber" hint="深度对不上 / 样号重复 / 封样超 2 小时" />
        <MetricCard label="待送检" value={counts.waiting} tone="blue" hint="现场判定合格，待登记重量送检" />
        <MetricCard label="已送检" value={counts.sent} tone="teal" hint="含在途与实验室待核对" />
        <MetricCard label="已入库（冻结）" value={counts.archived} tone="green" hint="合格结果写入，原记录冻结" />
        <MetricCard label="退回" value={counts.returned} tone="rose" hint="少样 / 重量不足 / 结果不合格" />
      </section>

      <section className="workspace">
        <LayerReference boreholes={boreholes} />

        <section className="panel register-panel">
          <div className="section-heading">
            <div>
              <p>现场登记</p>
              <h2>按回次登记取样</h2>
            </div>
          </div>
          <SampleForm
            key={formKey}
            boreholes={boreholes}
            submitLabel="登记样件"
            onSubmit={(draft) => handleRegister(draft)}
          />
        </section>
      </section>

      <Tracker
        records={records}
        filters={filters}
        onFiltersChange={setFilters}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onBatchSend={() => {
          if (selectedRecords.length === 0) {
            showBanner("请先勾选「待送检」状态的样件。");
            return;
          }
          setDialog({ kind: "send" });
        }}
        onOpenReceive={() => {
          if (pendingReceiveRecords.length === 0) {
            showBanner("当前没有已送检、待实验室核对的样件。");
            return;
          }
          setDialog({ kind: "receive", ids: pendingReceiveRecords.map((item) => item.id) });
        }}
        onReceiveOne={(record) => setDialog({ kind: "receive", ids: [record.id] })}
        onEdit={(record) => setDialog({ kind: "edit", record })}
        onCorrect={(record) => setDialog({ kind: "correct", record })}
        onWriteResult={(record) => setDialog({ kind: "result", record })}
        onDelete={handleDelete}
      />

      <footer className="app-footer">
        <p>
          资料（钻孔分层 / 样件类型）、判定（分层核对 · 样号查重 · 封样时限 · 收样核对 · 冻结与版本）、
          保存（localStorage）与界面相互独立；可继续扩展后端 API 与权限，不影响现有本地数据。
        </p>
      </footer>

      {dialog.kind === "send" && (
        <SendDialog
          records={selectedRecords}
          onCancel={() => setDialog({ kind: "none" })}
          onConfirm={confirmSend}
        />
      )}
      {dialog.kind === "receive" && (
        <ReceiveDialog
          records={records.filter((record) => dialog.ids.includes(record.id))}
          onCancel={() => setDialog({ kind: "none" })}
          onConfirm={confirmReceive}
        />
      )}
      {dialog.kind === "result" && (
        <ResultDialog
          record={dialog.record}
          onCancel={() => setDialog({ kind: "none" })}
          onConfirm={confirmResult}
        />
      )}
      {dialog.kind === "edit" && (
        <Modal title={`复核修改 · ${dialog.record.sampleNo}`} onClose={() => setDialog({ kind: "none" })}>
          <SampleForm
            boreholes={boreholes}
            initial={draftFromRecord(dialog.record)}
            submitLabel="保存并重新判定"
            onSubmit={handleRevise}
          />
        </Modal>
      )}
      {dialog.kind === "correct" && (
        <Modal
          title={`现场更正 · ${dialog.record.sampleNo}（原记录将冻结留档）`}
          onClose={() => setDialog({ kind: "none" })}
          width={640}
        >
          <SampleForm
            boreholes={boreholes}
            initial={draftFromRecord(dialog.record)}
            submitLabel="另建带原因版本"
            withReason
            reasonLabel="现场更正原因"
            onSubmit={handleCorrect}
          />
        </Modal>
      )}
    </main>
  );
}

export default App;
