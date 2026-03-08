import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReadPaper, StatsResponse } from "../api";
import { ApiError, api } from "../api";
import { StarButton } from "../components/StarButton";
import { usePaperActions } from "../hooks/usePaperActions";
import "./StatsPage.css";

// --- Utility functions ---

function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getLevel(count: number, maxCount: number): number {
  if (count === 0 || maxCount === 0) return 0;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function buildHeatmapData(daily: StatsResponse["daily"]): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of daily) {
    map.set(entry.date, entry.count);
  }
  return map;
}

function groupByDate(papers: ReadPaper[]): Map<string, ReadPaper[]> {
  const groups = new Map<string, ReadPaper[]>();
  for (const paper of papers) {
    const date = getDateKey(new Date(`${paper.read_at}Z`));
    const group = groups.get(date);
    if (group) {
      group.push(paper);
    } else {
      groups.set(date, [paper]);
    }
  }
  return groups;
}

function formatDateHeading(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${Number(y)}年${Number(m)}月${Number(d)}日`;
}

// --- Components ---

function Heatmap({ daily }: { daily: StatsResponse["daily"] }) {
  const countMap = buildHeatmapData(daily);
  const maxCount = daily.reduce((max, d) => Math.max(max, d.count), 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (52 * 7 + dayOfWeek));

  const weeks: { date: Date; count: number }[][] = [];
  let currentWeek: { date: Date; count: number }[] = [];

  const cursor = new Date(startDate);
  while (cursor <= today) {
    const key = getDateKey(cursor);
    currentWeek.push({ date: new Date(cursor), count: countMap.get(key) ?? 0 });
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks.length; w++) {
    const firstDay = weeks[w][0];
    const month = firstDay.date.getMonth();
    if (month !== lastMonth) {
      monthLabels.push({
        label: firstDay.date.toLocaleDateString("ja-JP", { month: "short" }),
        col: w,
      });
      lastMonth = month;
    }
  }

  const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, []);

  const gridStyle = {
    gridTemplateColumns: `auto repeat(${weeks.length}, 13px)`,
    gridTemplateRows: `auto repeat(7, 13px)`,
  };

  return (
    <div className="heatmap-container" ref={containerRef}>
      <div className="heatmap-grid" style={gridStyle}>
        {monthLabels.map((m) => (
          <span
            key={`${m.label}-${m.col}`}
            className="heatmap-month-label"
            style={{ gridColumn: m.col + 2, gridRow: 1 }}
          >
            {m.label}
          </span>
        ))}
        {dayLabels.map((label, i) => (
          <span key={label} className="heatmap-day-label" style={{ gridRow: i + 2 }}>
            {i % 2 === 1 ? label : ""}
          </span>
        ))}
        {weeks.map((week, wi) =>
          week.map((day) => {
            const dow = day.date.getDay();
            return (
              <div
                key={getDateKey(day.date)}
                className={`heatmap-cell level-${getLevel(day.count, maxCount)}`}
                style={{ gridColumn: wi + 2, gridRow: dow + 2 }}
                title={`${day.date.toLocaleDateString("ja-JP")}: ${day.count}本`}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}

function PaperItem({ paper, index }: { paper: ReadPaper; index: number }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { like, unlike } = usePaperActions();
  const [pending, setPending] = useState(false);

  const handleToggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setPending(true);
    try {
      await (paper.liked_at ? unlike(paper.id) : like(paper.id));
    } finally {
      setPending(false);
    }
  };

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  return (
    <div className="read-paper-item" style={{ "--i": Math.min(index, 15) } as React.CSSProperties}>
      <div className="read-paper-header">
        <button type="button" className="read-paper-title" onClick={open}>
          {paper.title}
        </button>
        <StarButton isLiked={!!paper.liked_at} onClick={handleToggleLike} disabled={pending} />
      </div>
      <dialog
        ref={dialogRef}
        className="paper-dialog"
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
      >
        <div className="paper-dialog-content">
          <div className="paper-dialog-header">
            <h2 className="paper-dialog-title">{paper.title}</h2>
            <button
              type="button"
              className="paper-dialog-close"
              onClick={close}
              aria-label="閉じる"
            >
              ✕
            </button>
          </div>
          <div className="paper-dialog-body">
            {paper.authors && <p className="paper-dialog-authors">{paper.authors}</p>}
            <p className="paper-dialog-conference">
              {paper.conference_name} {paper.year}
            </p>
            {paper.abstract_text && <p className="paper-dialog-abstract">{paper.abstract_text}</p>}
            {paper.url && (
              <a
                className="paper-dialog-link"
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                論文を開く
              </a>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}

function ReadPapersList({ papers }: { papers: ReadPaper[] }) {
  const grouped = useMemo(() => groupByDate(papers), [papers]);

  if (papers.length === 0) {
    return <p className="read-papers-empty">まだ論文を読んでいません。</p>;
  }

  return (
    <div className="read-papers-list">
      {[...grouped.entries()].map(([date, items]) => (
        <div key={date} className="read-papers-group">
          <h3 className="read-papers-date">{formatDateHeading(date)}</h3>
          {items.map((paper, i) => (
            <PaperItem key={paper.id} paper={paper} index={i} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.getStats(),
  });

  const { data: readPapers } = useQuery({
    queryKey: ["readPapers"],
    queryFn: () => api.getReadPapers(),
  });

  if (isLoading) {
    return <div className="stats-loading">統計情報を読み込み中...</div>;
  }

  if (isError) {
    const msg =
      error instanceof ApiError ? `エラー ${error.status}: ${error.message}` : error.message;
    return (
      <div className="error-message">
        <h2>エラー</h2>
        <p>{msg}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="stats-container">
      <h1>統計</h1>
      <div className="stats-summary">
        <div className="stats-card" style={{ "--i": 0 } as React.CSSProperties}>
          <span className="stats-card-value">{data.summary.today}</span>
          <span className="stats-card-label">今日</span>
        </div>
        <div className="stats-card" style={{ "--i": 1 } as React.CSSProperties}>
          <span className="stats-card-value">{data.summary.week}</span>
          <span className="stats-card-label">今週</span>
        </div>
        <div className="stats-card" style={{ "--i": 2 } as React.CSSProperties}>
          <span className="stats-card-value">{data.summary.total}</span>
          <span className="stats-card-label">累計</span>
        </div>
      </div>
      <Heatmap daily={data.daily} />

      {readPapers ? (
        <ReadPapersList papers={readPapers} />
      ) : (
        <p className="stats-loading">読み込み中...</p>
      )}
    </div>
  );
}
