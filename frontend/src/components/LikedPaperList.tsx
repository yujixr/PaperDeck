// frontend/src/components/LikedPaperList.tsx
import Masonry from 'react-masonry-css';
import type { Paper } from '../api';
import { LikedPaperCard } from './LikedPaperCard';
import './LikedPaperList.css';

// Masonry のブレークポイント設定
const breakpointCols = {
    default: 2, // デフォルト (2カラム)
    700: 1, // 700px 以下 (1カラム)
};

interface LikedPaperListProps {
    /** 表示する論文データの配列 */
    papers: Paper[];
}

/**
 * "いいね" した論文のリストを Masonry グリッドで表示するコンポーネント
 */
export function LikedPaperList({ papers }: LikedPaperListProps) {
    return (
        <Masonry
            breakpointCols={breakpointCols}
            className="my-masonry-grid"
            columnClassName="my-masonry-grid_column"
        >
            {papers.map((paper) => (
                <LikedPaperCard key={paper.id} paper={paper} />
            ))}
        </Masonry>
    );
}