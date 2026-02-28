import { schema } from './.zenstack/schema';
import type { ClientContract } from '@zenstackhq/orm';

type TestClient = ClientContract<typeof schema>;

// 检查是否有 userData 属性
type HasUserData = 'userData' extends keyof TestClient ? 'yes' : 'no';
const test1: HasUserData = 'yes';

// 检查是否有 findMany 方法
type UserDataMethods = TestClient['userData'];
type HasFindMany = UserDataMethods extends { findMany: any } ? 'yes' : 'no';
const test2: HasFindMany = 'yes';
