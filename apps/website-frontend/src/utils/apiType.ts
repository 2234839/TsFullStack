import type { DeepAsyncEffect } from '@tsfullstack/backend/dist-lib/rpc';
import { type API as __API__, type AppAPI as __AppAPI__ } from '@tsfullstack/backend';

type AppAPI = DeepAsyncEffect<__AppAPI__>;
type ApiResponseType<T extends (...args: any[]) => any> = Awaited<ReturnType<T>>;
export type loginByEmailPwd_res = ApiResponseType<AppAPI['system']['loginByEmailPwd']>;
