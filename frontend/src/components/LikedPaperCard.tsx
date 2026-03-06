import { useQueryClient } from "@tanstack/react-query";
import { api, type Paper } from "../api";
import { StarButton } from "./StarButton";
import "./Card.css";
import "./LikedPaperCard.css";

export function LikedPaperCard({ paper, style }: { paper: Paper; style?: React.CSSProperties }) {
  const queryClient = useQueryClient();

  const handleUnlike = async () => {
    await api.unlikePaper(paper.id);
    queryClient.setQueryData<Paper[]>(["likedPapers"], (old) =>
      old?.filter((p) => p.id !== paper.id),
    );
  };

  return (
    <div className="card liked-paper-item" style={style}>
      <div className="liked-paper-header">
        <p className="conference">
          {paper.conference_name} {paper.year}
        </p>
        <StarButton onClick={handleUnlike} isLiked={true} title="いいね取り消し" />
      </div>
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
