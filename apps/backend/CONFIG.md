# 配置文件说明

## 概述

本项目使用 `config.json` 作为配置文件，替代了之前的 `config.ts` 和 c12 配置系统。新的配置系统支持 JSON Schema 验证，可以在编辑时获得智能提示和语法检查。

## 配置文件

- **配置文件**: `config.json` (已添加到 .gitignore，不会被提交到版本控制)
- **示例文件**: `config.example.json` (可作为配置模板)
- **Schema 文件**: `config.schema.json` (用于编辑器提示和验证)

## 快速开始

1. 复制示例配置文件：
   ```bash
   cp config.example.json config.json
   ```

2. 编辑 `config.json` 文件，填入你的配置信息。支持 JSON Schema 智能提示。

## 配置项说明

### systemAdminUser
系统管理员账户配置
- `email`: 管理员邮箱地址
- `password`: 管理员密码，至少8位字符

### uploadDir
文件上传目录路径，支持相对路径和绝对路径
- 示例: `"./uploads"`, `"/tmp/uploads"`

### ApiProxy
API 代理配置，用于代理无法直接访问的 API 请求
- `github`: GitHub API 代理地址（可选）

### OAuth_github
GitHub OAuth 登录配置（可选）
- `clientId`: GitHub OAuth 应用的 Client ID
- `clientSecret`: GitHub OAuth 应用的 Client Secret
- `redirectUri`: OAuth 回调地址
- `scope`: 请求的权限范围，默认为 `["read:user", "user:email"]`

## 配置优先级

程序按以下优先级加载配置：
1. `config.json` (最高优先级)
2. `config.ts` (兼容性支持，会自动转换为 config.json)
3. 默认配置 (最低优先级)

## 编辑器支持

在 VSCode 中编辑 `config.json` 时，会获得以下智能提示：
- 字段自动补全
- 类型检查和验证
- 悬停提示
- 错误检查

## 安全提醒

- `config.json` 已添加到 `.gitignore`，不会提交到版本控制
- 请勿将包含敏感信息的配置文件提交到代码仓库
- 建议在不同环境使用不同的配置文件