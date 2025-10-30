// frontend/src/components/StatusMessage.tsx
import './StatusMessage.css';

type StatusMessageProps = {
    /** 表示するメッセージの文字列。nullまたはundefinedの場合は何も描画しません。 */
    message: string | null | undefined;
    /** メッセージの種類 ('success' または 'error') */
    type: 'success' | 'error';
};

/**
 * APIの成功/エラーメッセージを表示する汎用コンポーネント
 */
export function StatusMessage({ message, type }: StatusMessageProps) {
    // メッセージが null または undefined、または空文字列の場合は何も描画しない
    if (!message) {
        return null;
    }

    // type に応じてCSSクラスを動的に決定
    const className = `status-message status-message-${type}`;

    // <p> タグでメッセージを描画
    return <p className={className}>{message}</p>;
}