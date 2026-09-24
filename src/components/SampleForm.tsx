// 界面层：登记/更正共用表单（更正时锁定孔号·回次·样号，必须填写原因）

import { useState } from "react";
import type { Hole, SampleFormValues, SampleType } from "../types";
import { SAMPLE_TYPES } from "../types";
import { nowLocal } from "../utils";

interface Props {
  holes: Hole[];
  mode: "create" | "correct";
  initial?: SampleFormValues;
  onSubmit(values: SampleFormValues, reason: string): void;
  onCancel(): void;
}

export default function SampleForm({ holes, mode, initial, onSubmit, onCancel }: Props) {
  const [holeId, setHoleId] = useState(initial?.holeId ?? holes[0]?.id ?? "");
  const [runNo, setRunNo] = useState(initial ? String(initial.runNo) : "");
  const [sampleNo, setSampleNo] = useState(initial?.sampleNo ?? "");
  const [sampleType, setSampleType] = useState<SampleType>(initial?.sampleType ?? "原状样");
  const [top, setTop] = useState(initial ? String(initial.top) : "");
  const [bottom, setBottom] = useState(initial ? String(initial.bottom) : "");
  const [samplerId, setSamplerId] = useState(initial?.samplerId ?? "");
  const [sampledAt, setSampledAt] = useState(initial?.sampledAt ?? nowLocal());
  const [sealedAt, setSealedAt] = useState(initial?.sealedAt ?? nowLocal());
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const locked = mode === "correct";

  const submit = () => {
    const t = parseFloat(top);
    const b = parseFloat(bottom);
    const rn = parseInt(runNo, 10);
    if (!holeId) return setError("请选择孔号");
    if (!Number.isFinite(rn) || rn <= 0) return setError("请填写回次（正整数）");
    if (!sampleNo.trim()) return setError("请填写样号");
    if (!Number.isFinite(t) || !Number.isFinite(b)) return setError("请填写起止深度");
    if (!samplerId.trim()) return setError("请填写取土器编号");
    if (!sampledAt || !sealedAt) return setError("请填写取样与封样时刻");
    if (locked && !reason.trim()) return setError("现场更正必须填写原因");
    setError("");
    onSubmit(
      {
        holeId,
        runNo: rn,
        sampleNo: sampleNo.trim(),
        sampleType,
        top: t,
        bottom: b,
        samplerId: samplerId.trim(),
        sampledAt,
        sealedAt,
      },
      locked ? reason.trim() : "初始登记"
    );
  };

  return (
    <div className="sample-form">
      <h3>{mode === "create" ? "登记新样（按回次）" : "现场更正（另建带原因版本）"}</h3>
      <div className="field-grid">
        <label>
          <span>孔号</span>
          <select value={holeId} disabled={locked} onChange={(e) => setHoleId(e.target.value)}>
            {holes.map((h) => (
              <option key={h.id} value={h.id}>
                {h.id}（孔深 {h.depth}m）
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>回次</span>
          <input value={runNo} disabled={locked} onChange={(e) => setRunNo(e.target.value)} placeholder="如 7" inputMode="numeric" />
        </label>
        <label>
          <span>样号</span>
          <input value={sampleNo} disabled={locked} onChange={(e) => setSampleNo(e.target.value)} placeholder="如 ZK18-007" />
        </label>
        <label>
          <span>样型</span>
          <select value={sampleType} onChange={(e) => setSampleType(e.target.value as SampleType)}>
            {SAMPLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>起深度 (m)</span>
          <input value={top} onChange={(e) => setTop(e.target.value)} placeholder="如 7.0" inputMode="decimal" />
        </label>
        <label>
          <span>止深度 (m)</span>
          <input value={bottom} onChange={(e) => setBottom(e.target.value)} placeholder="如 7.5" inputMode="decimal" />
        </label>
        <label>
          <span>取土器编号</span>
          <input value={samplerId} onChange={(e) => setSamplerId(e.target.value)} placeholder="如 TQ-07" />
        </label>
        <label>
          <span>取样时刻</span>
          <input type="datetime-local" value={sampledAt} onChange={(e) => setSampledAt(e.target.value)} />
        </label>
        <label>
          <span>封样时刻</span>
          <input type="datetime-local" value={sealedAt} onChange={(e) => setSealedAt(e.target.value)} />
        </label>
        {locked && (
          <label>
            <span>更正原因（必填）</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如 止深度笔误，应为 7.5m" />
          </label>
        )}
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button className="primary-action" onClick={submit}>
          {mode === "create" ? "登记并复核" : "保存更正版本"}
        </button>
        <button onClick={onCancel}>取消</button>
      </div>
      <p className="form-hint">保存后自动复核：深度对不上分层、样号重复或封样超过两小时的，先留在待复核。</p>
    </div>
  );
}
