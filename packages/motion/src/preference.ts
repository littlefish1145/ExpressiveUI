import { createStore, mediaPreference } from '@epui/core';
export type MotionPreference = 'system' | 'full' | 'reduced';
const preference = createStore<MotionPreference>('system');
/** Explicit application policy; default always follows the operating system. */
export function getMotionPreference() {
  return preference.get();
}
export function setMotionPreference(value: MotionPreference) {
  if (!['system', 'full', 'reduced'].includes(value))
    throw new TypeError('Unknown motion preference');
  preference.set(value);
}
export function observeReducedMotion(changed?: (reduced: boolean) => void) {
  const matches = () =>
    preference.get() === 'reduced' || (preference.get() === 'system' && media.matches);
  const media = mediaPreference('(prefers-reduced-motion: reduce)', () => changed?.(matches()));
  const unsubscribe = preference.subscribe(() => changed?.(matches()));
  return {
    get matches() {
      return matches();
    },
    get systemMatches() {
      return media.matches;
    },
    destroy() {
      unsubscribe();
      media.destroy();
    },
  };
}
