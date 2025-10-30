// frontend/src/pages/LikedPapersPage.tsx
import { useQuery } from '@tanstack/react-query';
import {
    PapersApi,
    ResponseError,
} from '../api';
import { useApiClient } from '../hooks/useApiClient';
import { LikedPaperList } from '../components/LikedPaperList';

/**
 * いいねした論文カードコンポーネント (リスト内のアイテム)
 */

/**
 * いいねした論文の一覧を表示するページ
 */
export function LikedPapersPage() {
    // 汎用フックを使って PapersApi のインスタンスを取得
    const papersApi = useApiClient(PapersApi);

    // --- 1. データ取得 (GET /api/papers/liked) ---
    const {
        data: likedPapers,
        isLoading,
        isError,
        error,
    } = useQuery({
        queryKey: ['likedPapers'], // このページ専用のキャッシュキー
        queryFn: () => papersApi.getLikedPapers(),
        refetchOnWindowFocus: false, // オプション
    });

    // --- 2. 描画ロジック ---

    // 2.1. ローディング状態
    if (isLoading) {
        return <div>いいねした論文を読み込み中...</div>;
    }

    // 2.2. エラー状態
    if (isError) {
        const errorMessage =
            error instanceof ResponseError
                ? `エラー ${error.response.status}: ${error.message}`
                : error.message;
        return (
            <div className="error-message">
                <h2>エラー</h2>
                <p>いいねした論文の読み込みに失敗しました: {errorMessage}</p>
            </div>
        );
    }

    // 2.3. データなし (成功したが空配列)
    if (!likedPapers || likedPapers.length === 0) {
        return (
            <div className="all-done-message">
                <h2>いいねした論文はありません</h2>
                <p>ホーム画面に戻って、興味のある論文を探してみましょう！</p>
            </div>
        );
    }

    // 2.4. 成功状態 (データあり)
    return (
        <div className="liked-papers-container">
            <h1>いいねした論文 ({likedPapers.length})</h1>
            <LikedPaperList papers={likedPapers} />
        </div>
    );
}