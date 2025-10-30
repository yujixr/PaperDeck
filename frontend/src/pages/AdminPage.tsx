// frontend/src/pages/AdminPage.tsx
import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
    AdminApi,
    ResponseError,
    type CrawlPayload,
} from '../api';
import { useApiClient } from '../hooks/useApiClient';
import { CrawlForm } from '../components/CrawlForm';

/**
 * 管理者ページ
 * クローラーの実行をトリガーするUIを提供します。
 */
export function AdminPage() {
    // 汎用フックを使って AdminApi のインスタンスを取得
    const adminApi = useApiClient(AdminApi);

    // フォームのテキストエリアの状態 (デフォルトの例)
    const [urls, setUrls] = useState(
        'https://www.usenix.org/conference/usenixsecurity25/technical-sessions'
    );
    // APIからの成功/エラーメッセージの状態
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // 1. データ更新 (POST /api/admin/trigger_crawl) のための Mutation
    const { mutate, isPending } = useMutation({
        mutationFn: (payload: CrawlPayload) =>
            adminApi.triggerCrawl({ crawlPayload: payload }),

        onMutate: () => {
            // 新しいリクエストの前にメッセージをクリア
            setSuccessMessage(null);
            setErrorMessage(null);
        },

        onSuccess: () => {
            setSuccessMessage('クロールがバックグラウンドで開始されました。');
        },

        onError: async (error: unknown) => {
            // エラーハンドリング
            if (error instanceof ResponseError) {
                const status = error.response.status;
                try {
                    // エラーレスポンスの本文をテキストとして取得
                    const errorText = await error.response.text();
                    setErrorMessage(`エラー ${status}: ${errorText || error.message}`);
                } catch (e) {
                    setErrorMessage(`エラー ${status}: ${error.message}`);
                }
            } else if (error instanceof Error) {
                setErrorMessage(error.message);
            } else {
                setErrorMessage('不明なエラーが発生しました。');
            }
        },
    });

    // 2. フォーム送信ハンドラ
    const handleSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            // テキストエリアの内容を改行で分割し、空行や空白を除外
            const urlsToCrawl = urls
                .split('\n')
                .map((url) => url.trim())
                .filter((url) => url.length > 0);

            if (urlsToCrawl.length === 0) {
                setErrorMessage('最低1つのURLを入力してください。');
                return;
            }

            // APIを呼び出し
            mutate({ urls: urlsToCrawl });
        },
        [urls, mutate]
    );

    // 3. 描画
    return (
        <div
            className="admin-container"
            style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}
        >
            <h1>管理ページ</h1>
            <p>手動で論文クローラーを実行します。</p>

            <CrawlForm
                urls={urls}
                setUrls={setUrls}
                onSubmit={handleSubmit}
                isPending={isPending}
                successMessage={successMessage}
                errorMessage={errorMessage}
            />
        </div>
    );
}