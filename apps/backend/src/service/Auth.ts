import { Context } from 'effect';
import type { getPrisma } from '../db';

export type Database = Awaited<ReturnType<typeof getPrisma>>;
export class AuthService extends Context.Tag('Database')<
  AuthService,
  {
    db: Database['db'];
    user: Database['user'];
  }
>() {}
