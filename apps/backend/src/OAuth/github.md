# GitHub 认证库

一个简单易用的 TypeScript 库，用于实现 GitHub OAuth 认证。

## 快速开始

### 1. 创建 GitHub OAuth 应用

1. 访问 [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/developers)
2. 点击 "New OAuth App"
3. 填写应用信息：
   - Application name: 你的应用名称
   - Homepage URL: 你的应用主页
   - Authorization callback URL: 回调地址（如 `http://localhost:3000/auth/callback`）
4. 创建后获取 Client ID 和 Client Secret

### 2. 基本使用

```typescript
import { GitHubAuth } from 'github-auth-lib';

// 初始化
const githubAuth = new GitHubAuth({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'http://localhost:3000/auth/callback',
  scope: ['read:user', 'user:email'] // 可选
});

// 获取授权 URL
const authUrl = githubAuth.getAuthorizationUrl();

// 处理回调
const { user, accessToken } = await githubAuth.authenticate(code);
```

## API 文档

### GitHubAuth

#### 构造函数

```typescript
new GitHubAuth(config: GitHubAuthConfig)
```

**参数：**
- `config.clientId` (string): GitHub OAuth App 的 Client ID
- `config.clientSecret` (string): GitHub OAuth App 的 Client Secret
- `config.redirectUri` (string): 授权后的回调 URL
- `config.scope` (string[]): 请求的权限范围（可选）

#### 方法

##### getAuthorizationUrl(state?: string): string

生成 GitHub 授权页面的 URL。

**参数：**
- `state` (string): 可选的状态参数，用于防止 CSRF 攻击

**返回：**
- GitHub 授权页面的完整 URL

##### getAccessToken(code: string): Promise<TokenResponse>

使用授权码交换访问令牌。

**参数：**
- `code` (string): GitHub 返回的授权码

**返回：**
- 包含访问令牌的对象

##### getUser(accessToken: string): Promise<GitHubUser>

获取 GitHub 用户信息。

**参数：**
- `accessToken` (string): 访问令牌

**返回：**
- GitHub 用户信息对象

##### authenticate(code: string): Promise<{ user: GitHubUser; accessToken: string }>

完整的认证流程，包括获取令牌和用户信息。

**参数：**
- `code` (string): GitHub 返回的授权码

**返回：**
- 包含用户信息和访问令牌的对象

##### verifyToken(accessToken: string): Promise<boolean>

验证访问令牌是否有效。

**参数：**
- `accessToken` (string): 访问令牌

**返回：**
- 令牌是否有效

##### revokeToken(accessToken: string): Promise<void>

撤销访问令牌。

**参数：**
- `accessToken` (string): 要撤销的访问令牌


## 安全建议

1. **永远不要在客户端暴露 Client Secret**
2. **使用 HTTPS** 在生产环境中
3. **验证 state 参数** 以防止 CSRF 攻击
4. **安全存储访问令牌**，使用 httpOnly cookies 或安全的会话存储
5. **定期验证令牌** 的有效性
6. **实现令牌刷新机制** 如果需要长期访问