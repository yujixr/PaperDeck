// frontend/src/hooks/useApiClient.ts
import { useMemo } from 'react';
import type { Configuration, BaseAPI } from '../api';
import { apiConfig } from '../lib/apiConfig'; // 1. で作成した共有設定

/**
 * 任意の API クラスを受け取り、メモ化された API クライアントインスタンスを返すフック
 *
 * @param ApiClass - `new (config: Configuration) => T` というシグネチャを持つクラス
 * (例: AdminApi, PapersApi, AuthApi)
 */
export function useApiClient<T extends BaseAPI>(
    ApiClass: new (config: Configuration) => T
): T {
    // 共有の apiConfig を使って、指定されたクラスのインスタンスを生成
    // ApiClass が変わらない限り、インスタンスは再生成されない
    return useMemo(() => new ApiClass(apiConfig), [ApiClass]);
}