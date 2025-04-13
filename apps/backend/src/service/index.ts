import { Context } from 'effect';

export class AuthService extends Context.Tag('Database')<
  AuthService,
  {
    x_token_id: string;
  }
>() {}
