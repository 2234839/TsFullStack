// Template frontend components and utilities
export const frontendConfig = {
  version: '1.0.0',
  name: 'module-template-frontend'
};

// Conditional Vue imports to avoid backend compilation issues
let Vue: any;
try {
  Vue = require('vue');
} catch {
  // Vue not available, likely in backend context
}

export const createFrontendPlugin = () => {
  return {
    install: (app: any) => {
      console.log('Frontend template plugin installed');
    }
  };
};

export default {
  frontendConfig,
  createFrontendPlugin
};