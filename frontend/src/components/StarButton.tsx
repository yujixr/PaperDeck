// frontend/src/components/StarButton.tsx
import type { ComponentPropsWithoutRef } from 'react';
import './StarButton.css';

/**
 * StarButton コンポーネントのProps
 * 標準の <button> タグのプロパティ (onClick, disabled, title など) を継承
 */
type StarButtonProps = ComponentPropsWithoutRef<'button'> & {
    isLiked?: boolean;
};

/**
 * お気に入り（スター）用のスタイリング済みボタンコンポーネント
 */
export function StarButton({
    className,
    isLiked = false,
    ...rest
}: StarButtonProps) {
    // 外部から追加のクラスを受け入れつつ、基本クラスと 'liked' クラスを適用
    const classNames = [
        'star-button',
        isLiked ? 'liked' : '',
        className
    ].filter(Boolean).join(' ');

    return (
        <button className={classNames} {...rest}>
            ★
        </button>
    );
}