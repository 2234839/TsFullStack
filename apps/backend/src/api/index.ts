import { Effect } from 'effect';
import { ModelMeta } from '../db/model-meta';

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
  system: {
    getModelMeta() {
      return ModelMeta;
    },
  },
};
export type API = typeof apis;
