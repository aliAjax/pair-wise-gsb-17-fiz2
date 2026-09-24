import { useMemo, useState } from "react";
import type { SampleRecord } from "../data/types";
import Modal from "./Modal";

function depthText(record: SampleRecord): string {
  return `${record.depthFrom.toFixed(2)}–${record.depthTo.toFixed(2)}m`;
}

/* ---------------- 送检：登记申报重量 ---------------- */

interface SendDialogProps {
  records: SampleRecord[];
  onCancel: () => void;
  onConfirm: (weights: Record<string, number>) => string | null;
}

export function SendDialog({ records, onCancel, onConfirm }: SendDialogProps) {
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const count = records.length;

  const confirm = () => {
    const parsed: Record<string, number> = {};
    for (const record of records) {
      const raw = weights[record.id];
      const value = raw === undefined ? Number.NaN : Number(raw);
      if (!Number.isFinite(value) || value <= 0) {
        setError(`请填写 ${record.sampleNo} 的有效送样重量（kg，大于 0）`);
        return;
      }
      parsed[record.id] = value;
    }
    const message = onConfirm(parsed);
    if (message) setError(message);
  };

  return (
    <Modal title={`送检登记 · ${count} 件样`} onClose={onCancel} width={620}>
      <p className="dialog-tip">仅现场判定合格（待送检）的样件可送；申报重量随送检单提交实验室核对。</p>
      <table className="dialog-table">
        <thead>
          <tr>
            <th>孔号 / 回次</th>
            <th>样号</th>
            <th>样型</th>
            <th>深度</th>
            <th>申报重量 kg</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>{record.holeId} · 第{record.runNo}回次</td>
              <td className="mono">{record.sampleNo}</td>
              <td>{record.sampleType}</td>
              <td className="mono">{depthText(record)}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="如 1.35"
                  value={weights[record.id] ?? ""}
                  onChange={(event) =>
                    setWeights((prev) => ({ ...prev, [record.id]: event.target.value }))
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="dialog-footer">
        {error && <span className="form-feedback bad">{error}</span>}
        <span className="spacer" />
        <button type="button" onClick={onCancel}>取消</button>
        <button type="button" className="primary-action" onClick={confirm}>
          确认送检
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- 实验室收样：点样号、核重量，少样退回 ---------------- */

interface ReceiveDialogProps {
  records: SampleRecord[];
  onCancel: () => void;
  onConfirm: (
    arrivedIds: string[],
    receivedWeights: Record<string, number>,
  ) => string | null;
}

export function ReceiveDialog({ records, onCancel, onConfirm }: ReceiveDialogProps) {
  const [arrived, setArrived] = useState<Record<string, boolean>>(
    Object.fromEntries(records.map((record) => [record.id, true])),
  );
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const arrivedCount = useMemo(
    () => records.filter((record) => arrived[record.id]).length,
    [records, arrived],
  );

  const confirm = () => {
    const arrivedIds: string[] = [];
    const receivedWeights: Record<string, number> = {};
    for (const record of records) {
      if (!arrived[record.id]) continue; // 未到：少样退回
      arrivedIds.push(record.id);
      const value = Number(weights[record.id]);
      if (!Number.isFinite(value) || value <= 0) {
        setError(`请填写实收样 ${record.sampleNo} 的重量（kg）`);
        return;
      }
      receivedWeights[record.id] = value;
    }
    const message = onConfirm(arrivedIds, receivedWeights);
    if (message) setError(message);
  };

  return (
    <Modal title="实验室收样核对" onClose={onCancel} width={720}>
      <p className="dialog-tip">
        按送检清单逐件点样号、称重量。取消勾选即「少样」，该样按退回处理；实收重量少于申报 0.05kg 以上同样退回。
      </p>
      <table className="dialog-table">
        <thead>
          <tr>
            <th>样到</th>
            <th>孔号 / 回次</th>
            <th>样号</th>
            <th>深度</th>
            <th>申报 kg</th>
            <th>实收 kg</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const isArrived = arrived[record.id] !== false;
            return (
              <tr key={record.id} className={isArrived ? "" : "row-missing"}>
                <td>
                  <input
                    type="checkbox"
                    checked={isArrived}
                    onChange={(event) =>
                      setArrived((prev) => ({ ...prev, [record.id]: event.target.checked }))
                    }
                    aria-label={`${record.sampleNo} 是否送到`}
                  />
                </td>
                <td>{record.holeId} · 第{record.runNo}回次</td>
                <td className="mono">{record.sampleNo}</td>
                <td className="mono">{depthText(record)}</td>
                <td className="mono">{record.declaredWeight?.toFixed(2) ?? "—"}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    disabled={!isArrived}
                    placeholder={isArrived ? "实收重量" : "少样退回"}
                    value={weights[record.id] ?? ""}
                    onChange={(event) =>
                      setWeights((prev) => ({ ...prev, [record.id]: event.target.value }))
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="dialog-footer">
        <span className="dialog-count">
          到样 {arrivedCount}/{records.length}，少样 {records.length - arrivedCount}
        </span>
        <span className="spacer" />
        {error && <span className="form-feedback bad">{error}</span>}
        <button type="button" onClick={onCancel}>取消</button>
        <button type="button" className="primary-action" onClick={confirm}>
          提交核对结果
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- 试验结果写入（合格冻结入库） ---------------- */

interface ResultDialogProps {
  record: SampleRecord;
  onCancel: () => void;
  onConfirm: (result: string, qualified: boolean) => string | null;
}

export function ResultDialog({ record, onCancel, onConfirm }: ResultDialogProps) {
  const [result, setResult] = useState(record.result);
  const [qualified, setQualified] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    const message = onConfirm(result, qualified);
    if (message) setError(message);
  };

  return (
    <Modal title={`试验结果 · ${record.sampleNo}`} onClose={onCancel} width={600}>
        <dl className="result-meta">
          <div>
            <dt>孔号 / 回次</dt>
            <dd>{record.holeId} · 第{record.runNo}回次</dd>
          </div>
          <div>
            <dt>深度</dt>
            <dd className="mono">{depthText(record)}</dd>
          </div>
          <div>
            <dt>申报 / 实收重量</dt>
            <dd className="mono">
              {record.declaredWeight?.toFixed(2) ?? "—"} / {record.receivedWeight?.toFixed(2) ?? "—"} kg
            </dd>
          </div>
        </dl>
        <label className="stack-label">
          <span>试验结果（写入后冻结原记录，不可再改）</span>
          <textarea
            rows={4}
            placeholder="如 含水率22.1%，孔隙比0.71，压缩系数0.24MPa⁻¹"
            value={result}
            onChange={(event) => {
              setResult(event.target.value);
              setError(null);
            }}
          />
        </label>
        <div className="qualified-switch">
          <label>
            <input
              type="radio"
              name="qualified"
              checked={qualified}
              onChange={() => setQualified(true)}
            />
            结果合格 · 写入并冻结，样件入库
          </label>
          <label>
            <input
              type="radio"
              name="qualified"
              checked={!qualified}
              onChange={() => setQualified(false)}
            />
            结果不合格 · 退回现场（记录退回原因）
          </label>
        </div>
        <div className="dialog-footer">
          {error && <span className="form-feedback bad">{error}</span>}
          <span className="spacer" />
          <button type="button" onClick={onCancel}>取消</button>
          <button type="button" className="primary-action" onClick={confirm}>
            {qualified ? "写入结果并冻结入库" : "登记不合格退回"}
          </button>
        </div>
      </Modal>
  );
}
