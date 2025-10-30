// frontend/src/components/Form.tsx
import type { FormEvent, ReactNode } from 'react';
import { Button } from './Button';
import { StatusMessage } from './StatusMessage';
import './Form.css';

/**
 * 汎用 Form コンポーネントのProps
 */
interface FormProps {
    /** フォームの中身 (例: <div className="form-group">...</div>) */
    children: ReactNode;
    /** form タグの onSubmit イベントハンドラ */
    onSubmit: (e: FormEvent) => void;

    // --- ステータス関連 ---
    /** フォーム全体のエラーメッセージ */
    errorMessage: string | null;
    /** フォーム全体の成功メッセージ */
    successMessage?: string | null;
    /** 送信中かどうか (ボタンの disabled とローディングテキスト) */
    isSubmitting: boolean;

    // --- ボタン関連 ---
    /** 送信ボタンのテキスト */
    submitButtonText: string;
    /** 送信中の送信ボタンのテキスト */
    submitButtonLoadingText: string;
    /**
     * フォームが有効かどうか (送信ボタンの disabled に影響)
     * @default true
     */
    isFormValid?: boolean;
}

/**
 * アプリケーション全体で再利用可能なフォームの「ガワ」コンポーネント。
 * エラー表示、送信ボタン、ローディング状態をハンドリングします。
 */
export function Form({
    children,
    onSubmit,
    errorMessage,
    successMessage,
    isSubmitting,
    submitButtonText,
    submitButtonLoadingText,
    // isFormValid が渡されなかった場合は true (ボタン有効) として扱います
    isFormValid = true,
}: FormProps) {
    return (
        // .form-card スタイルを使用
        <div className="form-card">
            <form onSubmit={onSubmit}>
                {/* 成功・エラーメッセージをフォーム上部に表示 */}
                <StatusMessage message={successMessage} type="success" />
                <StatusMessage message={errorMessage} type="error" />

                {/* フォームの具体的な入力フィールド (AuthForm や CrawlForm から渡される) */}
                {children}

                {/* 送信ボタン */}
                <Button
                    type="submit"
                    variant="primary"
                    size="large"
                    fullWidth
                    disabled={isSubmitting || !isFormValid}
                >
                    {isSubmitting ? submitButtonLoadingText : submitButtonText}
                </Button>
            </form>
        </div>
    );
}