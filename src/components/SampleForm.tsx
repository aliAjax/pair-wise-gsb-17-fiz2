import { useState } from "react";
import type { Borehole, SampleDraft, SampleType } from "../data/types";
import { SAMPLE_TYPES } from "../data/types";
import { nowInputValue } from "../data/time";

interface SampleFormProps {
  boreholes: readonly Borehole[];
  initial?: Partial<SampleDraft>;
  submitLabel: string;
  onSubmit: (draft: SampleDraft, reason: string) => string | null;
  /** 是否需要“现场更正原因”输入 */
  withReason?: boolean;
  reasonLabel?: string;
}

function emptyDraft(): SampleDraft {
  return {
    holeId: "",
    runNo: "",
    sampleNo: "",
    depthFrom: "",
    depthTo: "",
    sampleType: "原状样",
    samplerNo: "",
    sealedAt: nowInputValue(),
  };
}

export default function SampleForm({
  boreholes,
  initial,
  submitLabel,
  onSubmit,
  withReason = false,
  reasonLabel = "更正原因",
}: SampleFormProps) {
  const [draft, setDraft] = useState<SampleDraft>({ ...emptyDraft(), ...initial });
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const update = (patch: Partial<SampleDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setFeedback(null);
  };

  const handleSubmit = () => {
    const error = onSubmit(draft, reason);
    if (error) {
      setFeedback({ ok: false, text: error });
      return;
    }
    setFeedback({
      ok: true,
      text: "已提交。进入待复核的样件请在下方台账处理问题后再送检。",
    });
    if (!initial) {
      setDraft(emptyDraft());
      setReason("");
    }
  };

  return (
    <div className="sample-form">
      <div className="field-grid">
        <label>
          <span>钻孔孔号 *</span>
          <select
            value={draft.holeId}
            onChange={(event) => update({ holeId: event.target.value })}
          >
            <option value="">选择钻孔</option>
            {boreholes.map((hole) => (
              <option key={hole.holeId} value={hole.holeId}>
                {hole.holeId}（孔深 {hole.totalDepth}m）
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>回次 *</span>
          <input
            type="number"
            min={1}
            step={1}
            placeholder="如 3"
            value={draft.runNo}
            onChange={(event) => update({ runNo: event.target.value })}
          />
        </label>
        <label>
          <span>样号 *</span>
          <input
            placeholder="如 Y-038 / N-012"
            value={draft.sampleNo}
            onChange={(event) => update({ sampleNo: event.target.value })}
          />
        </label>
        <label>
          <span>样型 *</span>
          <select
            value={draft.sampleType}
            onChange={(event) => update({ sampleType: event.target.value as SampleType })}
          >
            {SAMPLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>起深 m *</span>
          <input
            type="number"
            step={0.01}
            min={0}
            placeholder="如 5.00"
            value={draft.depthFrom}
            onChange={(event) => update({ depthFrom: event.target.value })}
          />
        </label>
        <label>
          <span>止深 m *</span>
          <input
            type="number"
            step={0.01}
            min={0}
            placeholder="如 5.20"
            value={draft.depthTo}
            onChange={(event) => update({ depthTo: event.target.value })}
          />
        </label>
        <label>
          <span>取土器 / 标贯器编号 *</span>
          <input
            placeholder="如 TY-07 / BG-02"
            value={draft.samplerNo}
            onChange={(event) => update({ samplerNo: event.target.value })}
          />
        </label>
        <label>
          <span>封样时刻 *</span>
          <input
            type="datetime-local"
            value={draft.sealedAt}
            onChange={(event) => update({ sealedAt: event.target.value })}
          />
        </label>
        {withReason && (
          <label className="field-wide">
            <span>{reasonLabel} *</span>
            <input
              placeholder="现场更正必须写明原因，随新版本一并留档"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setFeedback(null);
              }}
            />
          </label>
        )}
      </div>
      <p className="form-hint">
        提交时自动核对：深度须落在已编录分层内（容差 0.05m）、样号全项目不得重复、封样距登记不超过 2 小时；任一项不符先留「待复核」。
      </p>
      <div className="form-footer">
        <button type="button" className="primary-action" onClick={handleSubmit}>
          {submitLabel}
        </button>
        {feedback && (
          <span className={feedback.ok ? "form-feedback ok" : "form-feedback bad"}>
            {feedback.text}
          </span>
        )}
      </div>
    </div>
  );
}
