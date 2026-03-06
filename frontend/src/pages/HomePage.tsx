import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ApiError, api, type Paper } from "../api";
import { Button } from "../components/Button";
import { StarButton } from "../components/StarButton";
import { useConferenceFilter } from "../context/ConferenceFilterContext";
import "../components/Card.css";
import "./HomePage.css";

export function HomePage() {
  const queryClient = useQueryClient();
  const { filter } = useConferenceFilter();
  const filterRef = useRef(filter);
  filterRef.current = filter;

  // フィルタ変更時、現在の論文がフィルタに合致していればリフェッチしない
  useEffect(() => {
    if (filter === null) return; // 「すべて」は常に合致
    const current = queryClient.getQueryData<Paper>(["nextPaper"]);
    if (
      current &&
      current.conference_name === filter.conference &&
      String(current.year) === filter.year
    )
      return;
    queryClient.invalidateQueries({ queryKey: ["nextPaper"] });
  }, [filter, queryClient]);

  const {
    data: paper,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["nextPaper"],
    queryFn: () => {
      const f = filterRef.current;
      return api.getNextPaper(f ? { conference: f.conference, year: f.year } : undefined);
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const likeMutation = useMutation({
    mutationFn: (paperId: number) => api.likePaper(paperId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nextPaper"] });
      queryClient.invalidateQueries({ queryKey: ["likedPapers"] });
    },
  });

  const readMutation = useMutation({
    mutationFn: (paperId: number) => api.readPaper(paperId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nextPaper"] });
    },
  });

  const [exiting, setExiting] = useState(false);
  const pendingAction = useRef<"like" | "read" | null>(null);

  const isMutating = likeMutation.isPending || readMutation.isPending;

  const startExit = (action: "like" | "read") => {
    if (!paper || exiting) return;
    pendingAction.current = action;
    setExiting(true);
  };

  const handleAnimationEnd = () => {
    if (!exiting || !paper) return;
    setExiting(false);
    if (pendingAction.current === "like") {
      likeMutation.mutate(paper.id);
    } else {
      readMutation.mutate(paper.id);
    }
    pendingAction.current = null;
  };

  const handleLike = () => startExit("like");
  const handleRead = () => startExit("read");

  if (isLoading) {
    return (
      <div className="card paper-card paper-card-skeleton">
        <div className="skeleton" style={{ width: "30%", height: "0.8rem" }} />
        <div className="skeleton" style={{ width: "85%", height: "1.5rem" }} />
        <div className="skeleton" style={{ width: "60%", height: "1.5rem" }} />
        <div className="skeleton skeleton-abstract" />
      </div>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="all-done-message">
        <h2>すべて完了しました！</h2>
        <p>評価可能な論文はすべて評価済みです。お疲れ様でした！</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="error-message">
        <h2>エラー</h2>
        <p>論文の読み込みに失敗しました: {error.message}</p>
      </div>
    );
  }

  if (!paper) {
    return <div>論文が見つかりません。</div>;
  }

  return (
    <div
      className={`card paper-card${exiting ? " exiting" : ""}`}
      key={paper.id}
      onAnimationEnd={handleAnimationEnd}
    >
      <p className="conference">
        {paper.conference_name} {paper.year}
      </p>
      <div className="paper-title-container">
        <h3>{paper.title}</h3>
        <StarButton
          onClick={handleLike}
          disabled={isMutating}
          isLiked={false}
          title="いいね（興味あり）"
        />
      </div>
      <details>
        <summary>詳細（著者・リンク）</summary>
        <p className="authors" style={{ marginTop: "0.5rem" }}>
          {paper.authors || "著者情報なし"}
        </p>
        {paper.url && (
          <a href={paper.url} target="_blank" rel="noopener noreferrer">
            論文を読む
          </a>
        )}
      </details>
      <p className="abstract">{paper.abstract_text || "アブストラクトはありません。"}</p>
      <div className="card-actions">
        <Button variant="default" size="large" onClick={handleRead} disabled={isMutating}>
          {isMutating ? "..." : "次の論文を読む"}
        </Button>
      </div>
    </div>
  );
}
