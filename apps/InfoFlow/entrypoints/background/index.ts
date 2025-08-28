import { browser, defineBackground } from '#imports';
import { registerDbService } from './service/dbService';
import { registerConfigsService } from './service/configService';
import { registerRulesService } from './service/rulesService';
import { registerTaskExecutionService } from './service/taskExecutionService';

export default defineBackground(() => {


  registerDbService();
  registerConfigsService();
  registerRulesService();
  registerTaskExecutionService();
});
