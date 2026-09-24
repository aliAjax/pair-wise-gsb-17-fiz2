// 界面层：单条样品记录卡片（复核问题、实验室接收、版本历史、现场更正入口）

import { useState } from "react";
import type { SampleRecord } from "../types";
import { STATUS_LABEL } from "../types";
import { fmtTime } from "../utils";

interface Props {
  record: SampleRecord;
  onCorrect(record: SampleRecord): void;
  onReceive(id: string, weight: number, result: string): void;
  onReturn(id: string, reason: string): void;
}

export default function RecordCard({ record, onCorrect, onReceive, onReturn }: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const [weight, setWeight] = useState("");
  const [result, setResult] = useState("");
  const [noChecked, setNoChecked] = useState(false);
  const [returning, setReturning] = useState(false);
  const [returnReason, setReturnReason] = useState("");

  const v = record.versions[record.versions.length - 1];
  const frozen = record.status === "archived";
  const canReceive = noChecked && parseFloat(weight) > 0 && result.trim().length > 0;

  return (
    <article className="record-card sample-card">
      <div className="sample-head">
        <div>
          <h3>
            {record.holeId} · 回次{record.runNo} · 样号 {record.sampleNo}
            {frozen && <span className="frozen-tag">已冻结</span>}
          </h3>
          <p>
            {v.sampleType} | {v.top.toFixed(2)}~{v.bottom.toFixed(2)}m | 取土器 {v.samplerId} | 取样{" "}
            {fmtTime(v.sampledAt)} | 封样 {fmtTime(v.sealedAt)}
          </p>
        </div>
        <span className={`badge badge-${record.status}`}>{STATUS_LABEL[record.status]}</span>
      </div>

      {record.issues.length > 0 && (
        <ul className="issue-list">
          {record.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}

      {record.lab?.returnedReason && record.status === "returned" && (
        <p className="lab-line returned">退回原因：{record.lab.returnedReason}</p>
      )}
      {record.lab?.result && (
        <p className="lab-line">
          实收 {record.lab.weight}g · {fmtTime(record.lab.receivedAt)} 接收 · 结果：{record.lab.result}
        </p>
      )}

      {record.status === "sent" && (
        <div className="lab-form">
          <p className="lab-title">实验室接收核对</p>
          <div className="lab-row">
            <label className="check-label">
              <input type="checkbox" checked={noChecked} onChange={(e) => setNoChecked(e.target.checked)} />
              样号核对一致
            </label>
            <input value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="实收重量 g" inputMode="decimal" />
            <input value={result} onChange={(e) => setResult(e.target.value)} placeholder="试验结果摘要" />
            <button
              className="primary-action"
              disabled={!canReceive}
              onClick={() => onReceive(record.id, parseFloat(weight), result.trim())}
            >
              合格入库并冻结
            </button>
            <button onClick={() => setReturning((x) => !x)}>少样退回</button>
          </div>
          {returning && (
            <div className="lab-row">
              <input
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="退回原因，如 清单少1件，未见该样"
              />
              <button
                disabled={!returnReason.trim()}
                onClick={() => onReturn(record.id, returnReason.trim())}
              >
                确认退回
              </button>
            </div>
          )}
        </div>
      )}

      <div className="card-actions">
        <button onClick={() => setShowHistory((x) => !x)}>历史版本（{record.versions.length}）</button>
        <button onClick={() => onCorrect(record)}>现场更正</button>
      </div>

      {showHistory && (
        <ol className="version-list">
          {[...record.versions].reverse().map((ver) => (
            <li key={ver.version}>
              <strong>v{ver.version}</strong> {fmtTime(ver.time)} · {ver.operator} · {ver.reason} —— {ver.sampleType}{" "}
              {ver.top.toFixed(2)}~{ver.bottom.toFixed(2)}m，取土器 {ver.samplerId}，封样 {fmtTime(ver.sealedAt)}
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
