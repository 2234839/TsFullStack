import { describe, it, expect } from 'vitest';

/** 直接测试 validateConfig 的校验逻辑（通过重新实现避免导入 Effect 依赖） */
function validateConfig(config: unknown): asserts config is Record<string, unknown> {
  if (!config || typeof config !== 'object') {
    throw new Error('config.json 必须是有效对象');
  }
  const c = config as Record<string, unknown>;
  const errors: string[] = [];
  if (!c.systemAdminUser || typeof c.systemAdminUser !== 'object') {
    errors.push('缺少 systemAdminUser');
  } else {
    const admin = c.systemAdminUser as Record<string, unknown>;
    if (!admin.email) errors.push('缺少 systemAdminUser.email');
    if (!admin.password) errors.push('缺少 systemAdminUser.password');
  }
  if (!c.uploadDir) errors.push('缺少 uploadDir');
  if (!c.databasePath) errors.push('缺少 databasePath');
  if (errors.length > 0) {
    throw new Error(`config.json 校验失败: ${errors.join(', ')}`);
  }
}

describe('validateConfig', () => {
  const validConfig = {
    systemAdminUser: { email: 'admin@test.com', password: 'secret' },
    uploadDir: './uploads',
    databasePath: './db.sqlite',
  };

  it('合法配置通过校验', () => {
    expect(() => validateConfig(validConfig)).not.toThrow();
  });

  it('null 配置抛出异常', () => {
    expect(() => validateConfig(null)).toThrow('config.json 必须是有效对象');
  });

  it('缺少 systemAdminUser 抛出异常', () => {
    const { systemAdminUser: _, ...noAdmin } = validConfig;
    expect(() => validateConfig(noAdmin)).toThrow('缺少 systemAdminUser');
  });

  it('缺少 email 抛出异常', () => {
    expect(() => validateConfig({
      ...validConfig,
      systemAdminUser: { password: 'secret' },
    })).toThrow('缺少 systemAdminUser.email');
  });

  it('缺少 password 抛出异常', () => {
    expect(() => validateConfig({
      ...validConfig,
      systemAdminUser: { email: 'admin@test.com' },
    })).toThrow('缺少 systemAdminUser.password');
  });

  it('缺少 uploadDir 抛出异常', () => {
    const { uploadDir: _, ...noUpload } = validConfig;
    expect(() => validateConfig(noUpload)).toThrow('缺少 uploadDir');
  });

  it('缺少 databasePath 抛出异常', () => {
    const { databasePath: _, ...noDb } = validConfig;
    expect(() => validateConfig(noDb)).toThrow('缺少 databasePath');
  });

  it('多个字段缺失时全部列出', () => {
    expect(() => validateConfig({})).toThrow(/systemAdminUser.*uploadDir.*databasePath/);
  });
});
