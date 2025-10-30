// frontend/src/components/LikedPaperCard.tsx
import type { Paper } from '../api';
import './LikedPaperCard.css';

/**
 * いいねした論文カードコンポーネント (リスト内のアイテム)
 */
export function LikedPaperCard({ paper }: { paper: Paper }) {
    return (
        <div className="liked-paper-item">
            <p className="conference">
                {paper.conferenceName} {paper.year}
            </p>
            <h3>{paper.title}</h3>
            <p className="authors">{paper.authors || '著者情報なし'}</p>

            {paper.url && (
                <a href={paper.url} target="_blank" rel="noopener noreferrer">
                    論文を読む
                </a>
            )}

            {/* アブストラクトは詳細折りたたみで表示 */}
            <details>
                <summary>アブストラクト</summary>
                <p className="abstract">
                    {paper.abstractText || 'アブストラクトはありません。'}
                </p>
            </details>
        </div>
    );
}