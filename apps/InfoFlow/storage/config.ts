import { useWxtStorage } from './storageUtil';

export const infoFlowConfig = useWxtStorage('local:infoFlowConfig', {
  fallback: {
    test: 33,
  },
  version: 1,
});
