import { Effect } from 'effect';
import { seedDB } from './db/seed';
import { startServer } from './server';
import { loadConfig } from 'c12';
import { AppConfigService, type AppConfig } from './service/AppConfigService';

const main = Effect.gen(function* () {
  const { config } = yield* Effect.promise(() => loadConfig<AppConfig>({}));

  yield* Effect.promise(() => seedDB());
  yield* startServer.pipe(Effect.provideService(AppConfigService, config));
});

Effect.runPromise(main);
