import { Effect } from 'effect';
import { AppConfigService } from '../Context/AppConfig';
import { authApi } from './appApi/auth';
import { fileApi } from './appApi/file';
import { githubApi } from './appApi/github';
import { linuxdoApi } from './appApi/linuxdo';
import { shareApi } from './appApi/share';
import { treeholeApi } from './appApi/treehole';
import { noteCalcApi } from './appApi/noteCalc';
import { passcodeApi } from './appApi/passcode';

/** 无需鉴权的 api */
export const appApis = {
  system: authApi,
  githubApi,
  linuxdoApi,
  passcodeApi,
  /** 获取已配置的 OAuth 提供者列表（供前端判断显示哪些登录按钮） */
  oauthProviders() {
    return Effect.gen(function* () {
      const appConfig = yield* AppConfigService;
      const providers: string[] = [];
      if (appConfig.OAuth_github) providers.push('github');
      if (appConfig.OAuth_linuxdo) providers.push('linuxdo');
      /** 微信口令登录：配置了公众号服务器即可用（前端据此显示入口） */
      if (appConfig.wechat) providers.push('wechat');
      return providers;
    });
  },
  fileApi,
  shareApi,
  treeholeApi,
  noteCalcApi,
  /** 用于避免 Effect.isEffect 的判断之后得到 Effect<unknown, unknown, unknown> 导致类型系统失效*/
  __effect__() {
    return Effect.succeed('test');
  },
};
export type AppAPI = typeof appApis;
