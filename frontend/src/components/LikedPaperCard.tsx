import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Paper } from "../api";
import { usePaperActions } from "../hooks/usePaperActions";
import { detectLang } from "../lib/detectLang";
import { StarButton } from "./StarButton";
import "./Card.css";
import "./LikedPaperCard.css";

export function LikedPaperCard({ paper, style }: { paper: Paper; style?: React.CSSProperties }) {
  const queryClient = useQueryClient();
  const { unlike } = usePaperActions();

  const [pending, setPending] = useState(false);

  const handleUnlike = async () => {
    setPending(true);
    try {
      await unlike(paper.id);
      queryClient.setQueryData<Paper[]>(["likedPapers"], (old) =>
        old?.filter((p) => p.id !== paper.id),
      );
    } catch {
      setPending(false);
    }
  };

  return (
    <div className="card liked-paper-item" lang={detectLang(paper.title)} style={style}>
      <p className="conference">
        {paper.conference_name} {paper.year}
      </p>
      <StarButton onClick={handleUnlike} isLiked={true} disabled={pending} title="いいね取り消し" />
      <h3>{paper.title}</h3>
      <p className="authors">{paper.authors || "著者情報なし"}</p>
      {paper.url && (
        <a href={paper.url} target="_blank" rel="noopener noreferrer">
          論文を読む
        </a>
      )}
      <details>
        <summary>アブストラクト</summary>
        <p className="abstract">{paper.abstract_text || "アブストラクトはありません。"}</p>
      </details>
    </div>
  );
}
