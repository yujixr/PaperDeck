// frontend/src/components/CrawlForm.tsx
import type { FormEvent } from 'react';
import { Form } from './Form';
import './AuthForm.css';
import './CrawlForm.css';

/**
 * CrawlForm コンポーネントのProps
 * フォームの状態とイベントハンドラを親コンポーネント (AdminPage) から受け取ります。
 */
interface CrawlFormProps {
    urls: string;
    setUrls: (value: string) => void;
    isPending: boolean;
    successMessage: string | null;
    errorMessage: string | null;
    onSubmit: (e: FormEvent) => void;
}

/**
 * 管理者ページのクロール実行フォームUI
 * 状態やロジックは持たず、props として受け取ったものを描画します。
 */
export function CrawlForm({
    urls,
    setUrls,
    isPending,
    successMessage,
    errorMessage,
    onSubmit,
}: CrawlFormProps) {
    return (
        <Form
            onSubmit={onSubmit}
            errorMessage={errorMessage}
            successMessage={successMessage}
            isSubmitting={isPending}
            isFormValid={true} // CrawlForm は常に送信可能 (isFormValid を使わない)
            submitButtonText="バックグラウンドでクロールを開始"
            submitButtonLoadingText="クロールを開始中..."
        >
            {/* children として <textarea> のグループを渡す */}
            <div className="form-group">
                <label htmlFor="urls-textarea" style={{ fontWeight: 'bold' }}>
                    クロール対象URL (1行に1つ):
                </label>
                <textarea
                    id="urls-textarea"
                    rows={10}
                    value={urls}
                    onChange={(e) => setUrls(e.target.value)}
                    disabled={isPending}
                    placeholder="例: https://www.usenix.org/conference/usenixsecurity25/technical-sessions"
                />
            </div>
        </Form>
    );
}