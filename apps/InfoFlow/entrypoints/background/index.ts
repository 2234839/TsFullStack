import { browser, defineBackground } from '#imports';
import { registerDbService } from './service/dbService';
import { registerConfigsService } from './service/configService';
import { registerRulesService } from './service/rulesService';
import { registerTaskExecutionService } from './service/taskExecutionService';
import { registerCronService, getCronService } from './service/cronService';

export default defineBackground(() => {
  registerDbService();
  registerConfigsService();
  registerRulesService();
  registerTaskExecutionService();
  registerCronService();

  // Start all active rules when background script starts
  getCronService().startAllActiveRules().catch(console.error);
  if (import.meta.env.DEV) {
    browser.runtime.openOptionsPage();
  }
});
