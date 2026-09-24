import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type { AppState, SampleFormValues, SampleRecord, SampleStatus } from "./types";
import { STATUS_LABEL, STATUS_ORDER } from "./types";
import { loadState, saveState } from "./storage";
import { statusFor, validateSample } from "./rules";
import { nowLocal } from "./utils";
import SampleForm from "./components/SampleForm";
import RecordCard from "./components/RecordCard";

type TabKey = "all" | SampleStatus;

const TAB_LABEL: Record<TabKey, string> = { all: "全部", ...STATUS_LABEL };

function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [tab, setTab] = useState<TabKey>("all");
  const [holeFilter, setHoleFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 保存：任何状态变化即落盘，页面重开后待复核/已送检/已入库保持可分清
  useEffect(() => {
    saveState(state);
  }, [state]);

  const counts = useMemo(() => {
    const c: Record<SampleStatus, number> = { pending: 0, sent: 0, archived: 0, returned: 0 };
    state.records.forEach((r) => {
      c[r.status] += 1;
    });
    return c;
  }, [state.records]);

  // 检索：孔号、样号、回次、样型、取土器、复核问题（含深度差）、更正与退回原因、试验结果
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.records
      .filter((r) => {
        if (tab !== "all" && r.status !== tab) return false;
        if (holeFilter !== "all" && r.holeId !== holeFilter) return false;
        if (!q) return true;
        const v = r.versions[r.versions.length - 1];
        const hay = [
          r.holeId,
          r.sampleNo,
          String(r.runNo),
          v.sampleType,
          v.samplerId,
          ...r.issues,
          ...r.versions.map((x) => x.reason),
          r.lab?.result ?? "",
          r.lab?.returnedReason ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => a.holeId.localeCompare(b.holeId) || a.runNo - b.runNo);
  }, [state.records, tab, holeFilter, query]);

  const selectedHole = state.holes.find((h) => h.id === holeFilter);
  const selectedLayers = state.layers
    .filter((l) => l.holeId === holeFilter)
    .sort((a, b) => a.top - b.top);

  const addRecord = (values: SampleFormValues, reason: string) => {
    setState((prev) => {
      const record: SampleRecord = {
        id: `S${Date.now()}`,
        holeId: values.holeId,
        runNo: values.runNo,
        sampleNo: values.sampleNo,
        status: "sent",
        issues: [],
        versions: [
          {
            version: 1,
            time: nowLocal(),
            operator: "现场编录员",
            reason,
            sampleType: values.sampleType,
            top: values.top,
            bottom: values.bottom,
            samplerId: values.samplerId,
            sampledAt: values.sampledAt,
            sealedAt: values.sealedAt,
          },
        ],
      };
      const issues = validateSample(record, prev.records, prev.layers, prev.holes);
      return { ...prev, records: [...prev.records, { ...record, issues, status: statusFor(issues) }] };
    });
    setFormOpen(false);
  };

  // 现场更正：不改写原版本，另建一条带原因的版本并重新复核；已入库的原版本保持冻结
  const correctRecord = (values: SampleFormValues, reason: string) => {
    if (!editingId) return;
    setState((prev) => ({
      ...prev,
      records: prev.records.map((r) => {
        if (r.id !== editingId) return r;
        const next: SampleRecord = {
          ...r,
          versions: [
            ...r.versions,
            {
              version: r.versions.length + 1,
              time: nowLocal(),
              operator: "现场编录员",
              reason,
              sampleType: values.sampleType,
              top: values.top,
              bottom: values.bottom,
              samplerId: values.samplerId,
              sampledAt: values.sampledAt,
              sealedAt: values.sealedAt,
            },
          ],
        };
        const issues = validateSample(next, prev.records.filter((o) => o.id !== r.id), prev.layers, prev.holes);
        return { ...next, issues, status: statusFor(issues, r.status) };
      }),
    }));
    setEditingId(null);
  };

  // 实验室：核对样号与重量后合格入库，写入结果并冻结原记录
  const receiveRecord = (id: string, weight: number, result: string) => {
    setState((prev) => ({
      ...prev,
      records: prev.records.map((r) =>
        r.id === id
          ? { ...r, status: "archived", lab: { ...r.lab, receivedAt: nowLocal(), weight, result } }
          : r
      ),
    }));
  };

  // 实验室：少样/不符退回，记录原因
  const returnRecord = (id: string, reason: string) => {
    setState((prev) => ({
      ...prev,
      records: prev.records.map((r) =>
        r.id === id ? { ...r, status: "returned", lab: { ...r.lab, returnedReason: reason } } : r
      ),
    }));
  };

  const editingRecord = state.records.find((r) => r.id === editingId);
  const editingValues: SampleFormValues | undefined = editingRecord
    ? (() => {
        const v = editingRecord.versions[editingRecord.versions.length - 1];
        return {
          holeId: editingRecord.holeId,
          runNo: editingRecord.runNo,
          sampleNo: editingRecord.sampleNo,
          sampleType: v.sampleType,
          top: v.top,
          bottom: v.bottom,
          samplerId: v.samplerId,
          sampledAt: v.sampledAt,
          sealedAt: v.sealedAt,
        };
      })()
    : undefined;

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-03 · port 5103</p>
          <h1>钻孔取样与试验跟踪台</h1>
          <p className="subtitle">
            按回次登记样号、起止深度、样型、取土器编号与封样时刻；深度对不上分层、样号重复或封样超过两小时的先留在待复核。
            实验室核对样号与重量，少样退回，合格结果写入并冻结原记录；现场更正另建带原因的版本。
          </p>
        </div>
        <div className="stack-card">
          <span>数据流</span>
          <strong>登记 → 复核 → 送检 → 实验室核对 → 入库冻结</strong>
          <span>本地保存，重开页面状态不丢</span>
        </div>
      </section>

      <section className="metrics-grid">
        {STATUS_ORDER.map((s, i) => (
          <article key={s} className="metric-card">
            <span>{STATUS_LABEL[s]}</span>
            <strong>{counts[s]}</strong>
            <i className={["status-danger", "status-watch", "status-ok", "status-back"][i]} />
          </article>
        ))}
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <h2>检索</h2>
          <input
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="孔号 / 样号 / 深度差 / 原因"
          />

          <h2>状态</h2>
          <div className="tabs">
            {(["all", ...STATUS_ORDER] as TabKey[]).map((t) => (
              <button
                key={t}
                className={tab === t ? "tab active" : "tab"}
                onClick={() => setTab(t)}
              >
                {TAB_LABEL[t]}
                {t !== "all" && <em>{counts[t as SampleStatus]}</em>}
              </button>
            ))}
          </div>

          <h2>孔位</h2>
          <div className="hole-list">
            <button className={holeFilter === "all" ? "hole-item active" : "hole-item"} onClick={() => setHoleFilter("all")}>
              全部孔位
            </button>
            {state.holes.map((h) => {
              const holeRecords = state.records.filter((r) => r.holeId === h.id);
              const inTransit = holeRecords.filter((r) => r.status === "sent").length;
              return (
                <button
                  key={h.id}
                  className={holeFilter === h.id ? "hole-item active" : "hole-item"}
                  onClick={() => setHoleFilter(h.id)}
                >
                  <strong>{h.id}</strong>
                  <span>
                    孔深 {h.depth}m · 样 {holeRecords.length} 件 · 在途 {inTransit} 件
                  </span>
                </button>
              );
            })}
          </div>

          {selectedHole && (
            <>
              <h2>{selectedHole.id} 已编录分层</h2>
              <table className="layer-table">
                <thead>
                  <tr>
                    <th>层底</th>
                    <th>岩性</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedLayers.map((l) => (
                    <tr key={l.id}>
                      <td>
                        {l.top.toFixed(1)}~{l.bottom.toFixed(1)}m
                      </td>
                      <td>{l.soil}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </aside>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p>岩土工程 · 取样跟踪</p>
              <h2>样品台账（{filtered.length}）</h2>
            </div>
            <button
              className="primary-action"
              onClick={() => {
                setFormOpen((x) => !x);
                setEditingId(null);
              }}
            >
              登记新样
            </button>
          </div>

          {formOpen && (
            <SampleForm holes={state.holes} mode="create" onSubmit={addRecord} onCancel={() => setFormOpen(false)} />
          )}
          {editingRecord && editingValues && (
            <SampleForm
              holes={state.holes}
              mode="correct"
              initial={editingValues}
              onSubmit={correctRecord}
              onCancel={() => setEditingId(null)}
            />
          )}

          <div className="record-list">
            {filtered.length === 0 && <p className="empty-tip">当前筛选下没有样品记录。</p>}
            {filtered.map((r) => (
              <RecordCard
                key={r.id}
                record={r}
                onCorrect={(rec) => {
                  setEditingId(rec.id);
                  setFormOpen(false);
                }}
                onReceive={receiveRecord}
                onReturn={returnRecord}
              />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
