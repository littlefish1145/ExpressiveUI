export * from '@epui/core';
export * from '@epui/components';
export * from '@epui/theme';
export * as core from '@epui/core';
export * as components from '@epui/components';
export * as tokens from '@epui/tokens';
export * as shape from '@epui/shape';
export * as motion from '@epui/motion';
export * as theme from '@epui/theme';
export { init, destroy, getController, startAutoInit, stopAutoInit } from './auto.js';
import { startAutoInit } from './auto.js';
if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', startAutoInit, { once: true });
else startAutoInit();
