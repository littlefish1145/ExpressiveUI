export * from '@amiracle1024/core';
export * from '@amiracle1024/components';
export * from '@amiracle1024/theme';
export * as core from '@amiracle1024/core';
export * as components from '@amiracle1024/components';
export * as tokens from '@amiracle1024/tokens';
export * as shape from '@amiracle1024/shape';
export * as motion from '@amiracle1024/motion';
export * as theme from '@amiracle1024/theme';
export { init, destroy, getController, startAutoInit, stopAutoInit } from './auto.js';
import { startAutoInit } from './auto.js';
if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', startAutoInit, { once: true });
else startAutoInit();
