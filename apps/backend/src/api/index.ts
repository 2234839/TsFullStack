import { Effect } from 'effect';

export const apis = {
  a: {
    b(n: number) {
      return Effect.succeed((n + 2) as 3);
    },
    c(n: number) {
      return Effect.succeed((n + 2) as 3);
    },
  },
  b() {
    return 5 as const;
  },
};
export type API = typeof apis;
