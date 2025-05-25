import { Effect } from 'effect';
import { GitHubAuth } from '../../OAuth/github';
import { AppConfigService } from '../../service/AppConfigService';
import { MsgError } from '../../util/error';

/** 通过 Github 登录 */
export const githubApi = {
  getAuthorizationUrl() {
    return Effect.gen(function* () {
      const auth = yield* githubAuth;
      return auth.getAuthorizationUrl();
    });
  },
  authenticate(code: string) {
    return Effect.gen(function* () {
      const auth = yield* githubAuth;
      return yield* Effect.promise(() => auth.authenticate(code));
    });
  },
};

const githubAuth = Effect.gen(function* () {
  const { OAuth_github: oauth_github } = yield* AppConfigService;
  if (!oauth_github) {
    throw MsgError.msg('github oauth config not found');
  }
  return new GitHubAuth({
    scope: ['read:user', 'user:email'], // 可选
    ...oauth_github,
  });
});
