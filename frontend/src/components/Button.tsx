// frontend/src/components/Button.tsx
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import './Button.css';

// ボタンの外観を定義
type ButtonVariant = 'primary' | 'default';
// ボタンのサイズを定義
type ButtonSize = 'small' | 'medium' | 'large';

/**
 * ボタンコンポーネントのProps
 * 標準の <button> タグの全プロパティ (onClick, disabled, type など) を継承
 */
export interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
    children: ReactNode;
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
}

/**
 * アプリケーション全体で再利用可能な標準ボタンコンポーネント
 */
export function Button({
    children,
    variant = 'primary', // デフォルトは 'primary'
    size = 'medium',   // デフォルトは 'medium'
    fullWidth = false,
    className, // 外部から追加のクラスを受け取れるようにする
    ...rest // onClick, disabled, type="submit" などをそのまま渡す
}: ButtonProps) {

    // CSSクラスを動的に構築
    const classNames = [
        'btn', // 1. ベースクラス
        `btn-${variant}`, // 2. 外観 (primary, success, danger, default)
        `btn-${size}`,   // 3. サイズ (small, medium, large)
        fullWidth ? 'btn-full-width' : '', // 4. 全幅
        className, // 5. 外部から渡されたクラス
    ]
        .filter(Boolean) // null や undefined を除去
        .join(' '); // スペースで連結

    return (
        <button className={classNames} {...rest}>
            {children}
        </button>
    );
}