import { useQuery } from "@tanstack/react-query";
import Masonry from "react-masonry-css";
import { ApiError, api } from "../api";
import { LikedPaperCard } from "../components/LikedPaperCard";
import "./LikedPapersPage.css";

export function LikedPapersPage() {
  const {
    data: likedPapers,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["likedPapers"],
    queryFn: () => api.getLikedPapers(),
  });

  if (isLoading) {
    return <div>いいねした論文を読み込み中...</div>;
  }

  if (isError) {
    const errorMessage =
      error instanceof ApiError ? `エラー ${error.status}: ${error.message}` : error.message;
    return (
      <div className="error-message">
        <h2>エラー</h2>
        <p>いいねした論文の読み込みに失敗しました: {errorMessage}</p>
      </div>
    );
  }

  if (!likedPapers || likedPapers.length === 0) {
    return (
      <div className="all-done-message">
        <h2>いいねした論文はありません</h2>
        <p>ホーム画面に戻って、興味のある論文を探してみましょう！</p>
      </div>
    );
  }

  return (
    <div className="liked-papers-container">
      <h1>いいねした論文 ({likedPapers.length})</h1>
      <Masonry
        breakpointCols={{ default: 3, 1024: 2, 640: 1 }}
        className="my-masonry-grid"
        columnClassName="my-masonry-grid_column"
      >
        {likedPapers.map((paper, i) => (
          <LikedPaperCard
            key={paper.id}
            paper={paper}
            style={{ "--i": Math.min(i, 10) } as React.CSSProperties}
          />
        ))}
      </Masonry>
    </div>
  );
}
