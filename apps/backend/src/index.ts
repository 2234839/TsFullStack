import { seedConfig } from './config';
import { seedDB } from './db/seed';
import { startServer } from './server';

async function main() {
  await seedConfig();
  await seedDB();
  await startServer();
}
main();
