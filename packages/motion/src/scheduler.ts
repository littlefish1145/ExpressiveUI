type FrameTask = (seconds: number) => boolean;
const tasks = new Set<FrameTask>();
let frame: number | undefined,
  previous: number | undefined,
  listening = false;
function request() {
  if (frame === undefined && tasks.size && !(typeof document !== 'undefined' && document.hidden))
    frame = requestAnimationFrame(tick);
}
function visibility() {
  previous = undefined;
  if (document.hidden) {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
  } else request();
}
function cleanup() {
  if (tasks.size) return;
  if (frame !== undefined) cancelAnimationFrame(frame);
  frame = undefined;
  previous = undefined;
  if (listening) {
    document.removeEventListener('visibilitychange', visibility);
    listening = false;
  }
}
function tick(now: number) {
  frame = undefined;
  const elapsed = previous === undefined ? 0 : (now - previous) / 1000;
  // Drop suspension gaps; bound large active frame deltas. No catch-up loops or layout reads.
  const dt = elapsed > 0.25 ? 0 : Math.max(0, Math.min(elapsed, 0.064));
  previous = now;
  const errors: unknown[] = [];
  for (const task of tasks) {
    try {
      if (!task(dt)) tasks.delete(task);
    } catch (error) {
      tasks.delete(task);
      errors.push(error);
    }
  }
  cleanup();
  request();
  for (const error of errors)
    queueMicrotask(() => {
      throw error;
    });
}
export function scheduleFrame(task: FrameTask): () => void {
  tasks.add(task);
  if (!listening && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', visibility);
    listening = true;
  }
  request();
  return () => {
    tasks.delete(task);
    cleanup();
  };
}
export function activeAnimationCount() {
  return tasks.size;
}
