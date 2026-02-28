import { schema } from './.zenstack/schema';
import type { ClientContract } from '@zenstackhq/orm';

// 测试 ClientContract 的类型结构
type TestClient = ClientContract<typeof schema>;

// 尝试访问 role 模型
type TestRole = TestClient['role'];

// 检查 role 上是否有 findMany 方法
type TestFindMany = TestRole extends { findMany: any } ? 'yes' : 'no';

// 预期结果
const test: TestFindMany = 'yes'; // 如果编译失败，说明类型结构不对
console.log(test);
