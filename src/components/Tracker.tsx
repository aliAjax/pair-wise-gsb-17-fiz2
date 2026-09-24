import { Fragment, useMemo, useState } from "react";
import type { SampleRecord, SampleStatus } from "../data/types";
import { SAMPLE_STATUSES } from "../data/types";
import { displayTime } from "../data/time";

export interface TrackerFilters {
  tab: SampleStatus | "全部";
  query: string;
  holeId: string;
  maxGap: string;
}

interface TrackerProps {
  records: readonly SampleRecord[];
  filters: TrackerFilters;
  onFiltersChange: (filters: TrackerFilters) => void;
  selectedIds: ReadonlySet<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[], checked: boolean) => void;
  onBatchSend: () => void;
  onOpenReceive: () => void;
  onReceiveOne: (record: SampleRecord) => void;
  onEdit: (record: SampleRecord) => void;
  onCorrect: (record: SampleRecord) => void;
  onWriteResult: (record: SampleRecord) => void;
  onDelete: (record: SampleRecord) => void;
}

const STATUS_LABEL: Record<SampleStatus, string> = {
  待复核: "待复核",
  待送检: "待送检",
  已送检: "已送检",
  已入库: "已入库",
  退回: "退回",
};

function issueChips(record: SampleRecord) {
  return record.issues.map((item, index) => (
    <span key={`${item.code}-${index}`} className={`issue-chip ${item.code.toLowerCase()}`}>
      {item.code === "DEPTH_MISMATCH" && item.depthGap !== undefined
        ? `深度差 ${item.depthGap.toFixed(2)}m`
        : item.code === "SEAL_TIMEOUT"
          ? "封样超 2 小时"
          : item.code === "DUPLICATE_NO"
            ? "样号重复"
            : item.code === "SEAL_INVALID"
              ? "封样时刻无效"
              : item.code === "DEPTH_ORDER"
                ? "深度顺序错"
                : item.code === "LAYER_MISSING"
                  ? "缺分层资料"
                  : "资料缺失"}
    </span>
  ));
}

function RowActions({
  record,
  onEdit,
  onCorrect,
  onReceiveOne,
  onWriteResult,
  onDelete,
}: Pick<TrackerProps, "onEdit" | "onCorrect" | "onReceiveOne" | "onWriteResult" | "onDelete"> & {
  record: SampleRecord;
}) {
  if (record.supersededBy) {
    return <span className="row-muted-note">已被 v{record.version + 1} 替代</span>;
  }
  return (
    <div className="row-actions">
      {!record.frozen && (
        <button type="button" className="mini" onClick={() => onEdit(record)}>
          复核修改
        </button>
      )}
      {record.status === "已送检" && !record.labReceived && (
        <button type="button" className="mini" onClick={() => onReceiveOne(record)}
          title="打开该样的实验室收样核对">
          收样核对
        </button>
      )}
      {record.status === "已送检" && record.labReceived && !record.frozen && (
        <button type="button" className="mini primary-mini" onClick={() => onWriteResult(record)}>
          写结果
        </button>
      )}
      {(record.status === "已入库" || record.status === "退回") && (
        <button type="button" className="mini" onClick={() => onCorrect(record)}>
          现场更正
        </button>
      )}
      {!record.frozen && (
        <button
          type="button"
          className="mini danger-mini"
          onClick={() => onDelete(record)}
        >
          删除
        </button>
      )}
    </div>
  );
}

export default function Tracker({
  records,
  filters,
  onFiltersChange,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onBatchSend,
  onOpenReceive,
  onReceiveOne,
  onEdit,
  onCorrect,
  onWriteResult,
  onDelete,
}: TrackerProps) {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());

  const counts = useMemo(() => {
    const result = new Map<SampleStatus | "全部", number>();
    result.set("全部", records.filter((item) => !item.supersededBy).length);
    for (const status of SAMPLE_STATUSES) {
      result.set(
        status,
        records.filter((item) => item.status === status && !item.supersededBy).length,
      );
    }
    return result;
  }, [records]);

  const filtered = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    const maxGap = filters.maxGap === "" ? Number.NaN : Number(filters.maxGap);
    return records
      .filter((record) => {
        if (filters.tab !== "全部" && record.status !== filters.tab) return false;
        if (filters.holeId && record.holeId !== filters.holeId) return false;
        if (Number.isFinite(maxGap)) {
          const gap = record.issues.find((item) => item.depthGap !== undefined)?.depthGap;
          if (gap === undefined || gap > maxGap) return false;
        }
        if (query) {
          const haystack = [
            record.holeId,
            record.sampleNo,
            record.samplerNo,
            record.sampleType,
            record.returnReason,
            record.correctionReason,
            record.result,
            ...record.issues.map((item) => `${item.code} ${item.message}`),
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const hole = a.holeId.localeCompare(b.holeId);
        if (hole !== 0) return hole;
        if (a.runNo !== b.runNo) return a.runNo - b.runNo;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [records, filters]);

  const selectableInView = filtered.filter(
    (record) => record.status === "待送检" && !record.supersededBy,
  );
  const allChecked =
    selectableInView.length > 0 &&
    selectableInView.every((record) => selectedIds.has(record.id));

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pendingReceiveCount = records.filter(
    (record) => record.status === "已送检" && !record.labReceived && !record.supersededBy,
  ).length;

  return (
    <section className="panel tracker-panel">
      <div className="section-heading">
        <div>
          <p>取样与试验跟踪台</p>
          <h2>样件台账</h2>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            onClick={onOpenReceive}
            disabled={pendingReceiveCount === 0}
            title="对已送检未核对的样件逐件点样号、核重量"
          >
            实验室收样核对{pendingReceiveCount > 0 ? `（${pendingReceiveCount}）` : ""}
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={onBatchSend}
            disabled={selectedIds.size === 0}
          >
            送检（{selectedIds.size}）
          </button>
        </div>
      </div>

      <div className="status-tabs" role="tablist">
        {(["全部", ...SAMPLE_STATUSES] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={filters.tab === tab}
            className={filters.tab === tab ? `tab active tab-${tab}` : `tab tab-${tab}`}
            onClick={() => onFiltersChange({ ...filters, tab })}
          >
            {tab === "全部" ? "全部" : STATUS_LABEL[tab]}
            <span className="tab-count">{counts.get(tab) ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="tracker-toolbar">
        <input
          className="search-input"
          placeholder="搜孔号 / 样号 / 取土器 / 原因 / 结果，或“深度差”“样号重复”"
          value={filters.query}
          onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
        />
        <select
          value={filters.holeId}
          onChange={(event) => onFiltersChange({ ...filters, holeId: event.target.value })}
          aria-label="按孔号筛选"
        >
          <option value="">全部孔号</option>
          {[...new Set(records.map((record) => record.holeId))].sort().map((holeId) => (
            <option key={holeId} value={holeId}>{holeId}</option>
          ))}
        </select>
        <label className="gap-filter">
          深度差 ≤
          <input
            type="number"
            min={0}
            step={0.05}
            placeholder="m"
            value={filters.maxGap}
            onChange={(event) => onFiltersChange({ ...filters, maxGap: event.target.value })}
          />
          m
        </label>
      </div>

      <div className="table-scroll">
        <table className="tracker-table">
          <thead>
            <tr>
              <th className="col-check">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(event) =>
                    onToggleSelectAll(
                      selectableInView.map((record) => record.id),
                      event.target.checked,
                    )
                  }
                  disabled={selectableInView.length === 0}
                  title="全选当前可见的待送检样件"
                />
              </th>
              <th>孔号 / 回次</th>
              <th>样号</th>
              <th>起止深度</th>
              <th>样型 / 取土器</th>
              <th>封样时刻</th>
              <th>状态 / 复核问题</th>
              <th>送检 → 收样</th>
              <th>试验结果 / 退回·更正原因</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="empty-row">
                  当前筛选下没有样件记录
                </td>
              </tr>
            )}
            {filtered.map((record) => {
              const isSuperseded = Boolean(record.supersededBy);
              const expanded = expandedIds.has(record.id);
              const selectable = record.status === "待送检" && !isSuperseded;
              return (
                <Fragment key={record.id}>
                  <tr
                    className={[
                      `st-${record.status}`,
                      isSuperseded ? "row-superseded" : "",
                      record.frozen ? "row-frozen" : "",
                    ].join(" ")}
                  >
                    <td className="col-check">
                      {selectable ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(record.id)}
                          onChange={() => onToggleSelect(record.id)}
                        />
                      ) : (
                        <span className="check-placeholder">·</span>
                      )}
                    </td>
                    <td>
                      <strong>{record.holeId}</strong>
                      <span className="cell-sub">第 {record.runNo} 回次{record.version > 1 ? ` · v${record.version}` : ""}</span>
                      {record.supersedesId && (
                        <span className="version-tag">更正自 v{record.version - 1}</span>
                      )}
                    </td>
                    <td className="mono">{record.sampleNo}</td>
                    <td className="mono">
                      {record.depthFrom.toFixed(2)}–{record.depthTo.toFixed(2)}
                      {record.issues.some((item) => item.code === "DEPTH_MISMATCH") && (
                        <span className="cell-flag">跨层/超深</span>
                      )}
                    </td>
                    <td>
                      {record.sampleType}
                      <span className="cell-sub mono">{record.samplerNo}</span>
                    </td>
                    <td className="cell-time">{displayTime(record.sealedAt)}</td>
                    <td>
                      <span className={`status-badge sb-${record.status}`}>
                        {record.frozen && record.status === "已入库" ? "已入库·冻结" : record.status}
                      </span>
                      {record.issues.length > 0 && (
                        <div className="issue-list">{issueChips(record)}</div>
                      )}
                    </td>
                    <td className="weight-cell">
                      <span className="mono">
                        {record.declaredWeight !== null ? `${record.declaredWeight.toFixed(2)}kg` : "—"}
                      </span>
                      <span className="arrow">→</span>
                      <span className="mono">
                        {record.receivedWeight !== null ? `${record.receivedWeight.toFixed(2)}kg` : "—"}
                      </span>
                      <span className="cell-sub">
                        {record.sentAt ? `送 ${displayTime(record.sentAt)}` : "未送检"}
                      </span>
                      {record.receivedAt && (
                        <span className="cell-sub">收 {displayTime(record.receivedAt)}</span>
                      )}
                    </td>
                    <td className="reason-cell">
                      {record.result && <p className="result-text">{record.result}</p>}
                      {record.returnReason && (
                        <p className="reason-text return">{record.returnReason}</p>
                      )}
                      {record.correctionReason && (
                        <p className="reason-text correct">更正原因：{record.correctionReason}</p>
                      )}
                      {!record.result && !record.returnReason && !record.correctionReason && (
                        <span className="row-muted-note">—</span>
                      )}
                    </td>
                    <td>
                      <RowActions
                        record={record}
                        onEdit={onEdit}
                        onCorrect={onCorrect}
                        onReceiveOne={onReceiveOne}
                        onWriteResult={onWriteResult}
                        onDelete={onDelete}
                      />
                      <button
                        type="button"
                        className="mini link-mini"
                        onClick={() => toggleExpanded(record.id)}
                      >
                        {expanded ? "收起留痕" : "留痕"}
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="log-row">
                      <td colSpan={10}>
                        <div className="log-box">
                          <p className="log-title">操作留痕 · {record.sampleNo}{record.version > 1 ? ` · v${record.version}` : ""}</p>
                          <ul>
                            {record.log.map((entry, index) => (
                              <li key={index}>
                                <time>{displayTime(entry.at)}</time>
                                <span>{entry.text}</span>
                              </li>
                            ))}
                          </ul>
                          {record.issues.length > 0 && (
                            <div className="log-issues">
                              <p>当前复核问题（可按孔号、样号、深度差检索）：</p>
                              <ul>
                                {record.issues.map((item, index) => (
                                  <li key={index}>
                                    {item.message}
                                    {item.depthGap !== undefined && (
                                      <em>（深度差 {item.depthGap.toFixed(2)}m）</em>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
