import { transform } from 'sucrase';
self.addEventListener('message', (event) => {
  const { id, source, react } = event.data;
  try {
    if (typeof source !== 'string' || source.length > 2_000_000) throw Error('代码过长或格式无效');
    const result = transform(source, {
      transforms: ['typescript', ...(react ? ['jsx' as const] : []), 'imports'],
      jsxRuntime: 'automatic',
      production: true,
      filePath: react ? 'example.tsx' : 'example.ts',
    });
    self.postMessage({ id, code: result.code });
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
});
