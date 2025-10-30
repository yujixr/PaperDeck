// frontend/src/pages/HomePage.tsx
import { useState, useEffect } from 'react'; // ★ useState, useEffect をインポート
import {
    useQuery,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import {
    PapersApi,
    ResponseError,
    PaperStatus,
} from '../api';

import { Button } from '../components/Button';
import { StarButton } from '../components/StarButton';
import { useApiClient } from '../hooks/useApiClient';

/**
 * 論文を評価するためのメインページ。
 */
export function HomePage() {
    const queryClient = useQueryClient();
    const papersApi = useApiClient(PapersApi);

    // 1. 現在の論文をいいねしたかどうかのローカル状態
    const [isCurrentLiked, setIsCurrentLiked] = useState(false);

    // --- 1. データ取得 (GET /api/papers/next) ---
    const {
        data: paper,
        isLoading,
        isError,
        error,
    } = useQuery({
        queryKey: ['nextPaper'], // React Query のキャッシュキー
        queryFn: () => papersApi.getNextPaper(),
        refetchOnWindowFocus: false, // ウィンドウフォーカスで再フェッチしない
        retry: (failureCount, error) => {
            // 404 (Not Found) は「未評価の論文がない」という正常なレスポンスとして扱う
            if (error instanceof ResponseError && error.response.status === 404) {
                return false; // リトライしない
            }
            // その他のエラーは3回までリトライ
            return failureCount < 3;
        },
    });

    // 2. 新しい論文が読み込まれたら、ローカルのいいね状態をリセット
    useEffect(() => {
        // paper が (再) 読み込みされたら、スターの状態をリセット
        setIsCurrentLiked(false);
    }, [paper?.id]); // paper.id が変わった時 (＝次の論文になった時) に実行

    // --- 3. データ更新 (POST /api/papers/:id/status) ---
    const { mutate, isPending: isMutating } = useMutation({
        mutationFn: (variables: { paperId: number; status: PaperStatus }) =>
            papersApi.setPaperStatus({
                paperId: variables.paperId,
                statusPayload: { status: variables.status },
            }),

        onSuccess: (_data, variables) => {
            if (variables.status === PaperStatus.Read) {
                queryClient.invalidateQueries({ queryKey: ['nextPaper'] });
            }
            if (variables.status === PaperStatus.Liked) {
                // いいねリストを裏側で更新
                queryClient.invalidateQueries({ queryKey: ['likedPapers'] });
            }
        },
        onError: (err, variables) => {
            console.error('Failed to set paper status:', err);
            if (variables.status === PaperStatus.Liked) {
                setIsCurrentLiked(false);
            }
        },
    });

    // --- 4. イベントハンドラ ---
    const handleRate = (status: PaperStatus) => {
        if (paper) {
            mutate({ paperId: paper.id, status });

            // 3. 'Liked' が押されたら、ローカル状態を true に設定
            if (status === PaperStatus.Liked) {
                setIsCurrentLiked(true);
            }
        }
    };

    // --- 5. 描画ロジック ---

    // 4.1. ローディング状態
    if (isLoading) {
        return <div>次の論文を読み込み中...</div>;
    }

    // 4.2. "すべて完了" 状態 (404 エラー)
    if (error instanceof ResponseError && error.response.status === 404) {
        return (
            <div className="all-done-message">
                <h2>🎉 すべて完了しました！</h2>
                <p>評価可能な論文はすべて評価済みです。お疲れ様でした！</p>
            </div>
        );
    }

    // 4.3. 汎用エラー状態
    if (isError) {
        return (
            <div className="error-message">
                <h2>エラー</h2>
                <p>論文の読み込みに失敗しました: {error.message}</p>
            </div>
        );
    }

    // 4.4. 成功状態 (論文データが利用可能)
    if (!paper) {
        // isError/isLoading でないのに paper がない場合 (念のため)
        return <div>論文が見つかりません。</div>;
    }

    return (
        <div className="paper-card">
            {/* 論文情報 */}
            <p className="conference">
                {paper.conferenceName} {paper.year}
            </p>

            {/* --- タイトルとスターボタン --- */}
            <div className="paper-title-container">
                <h3>{paper.title}</h3>
                <StarButton
                    onClick={() => handleRate(PaperStatus.Liked)}
                    disabled={isMutating || isCurrentLiked}
                    isLiked={isCurrentLiked}
                    title="いいね（興味あり）"
                />
            </div>

            <details>
                <summary>詳細（著者・リンク）</summary>
                <p className="authors" style={{ marginTop: '0.5rem' }}>
                    {paper.authors || '著者情報なし'}
                </p>

                {paper.url && (
                    <a href={paper.url} target="_blank" rel="noopener noreferrer">
                        論文を読む
                    </a>
                )}
            </details>

            <p className="abstract">
                {paper.abstractText || 'アブストラクトはありません。'}
            </p>

            {/* --- アクションボタン --- */}
            <div className="card-actions">
                <Button
                    variant="default"
                    size="large"
                    onClick={() => handleRate(PaperStatus.Read)}
                    disabled={isMutating}
                >
                    {isMutating ? '...' : '次の論文を読む'}
                </Button>
            </div>
        </div>
    );
}