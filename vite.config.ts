import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { renderPlaygroundCatalog } from './scripts/playground-template.ts';
const names = ['core', 'tokens', 'shape', 'motion', 'theme', 'components', 'adapter-react'];
export default defineConfig({
  root: 'playground',
  plugins: [
    {
      name: 'cdn-document-route',
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (request.url?.split('?')[0] === '/cdn')
            request.url = request.url.replace('/cdn', '/cdn.html');
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (request.url?.split('?')[0] === '/cdn')
            request.url = request.url.replace('/cdn', '/cdn.html');
          next();
        });
      },
    },
    {
      name: 'static-component-catalog',
      transformIndexHtml(html, context) {
        if (!/[\\/]playground[\\/]index\.html$/.test(context.filename)) return html;
        const catalog = readFileSync(
          new URL('./playground/src/catalog.html', import.meta.url),
          'utf8',
        );
        const extensions = readFileSync(
          new URL('./playground/src/extensions.html', import.meta.url),
          'utf8',
        );
        return renderPlaygroundCatalog(html, catalog, extensions);
      },
    },
  ],
  resolve: {
    alias: [
      {
        find: '@epui/theme/runtime',
        replacement: fileURLToPath(new URL('./packages/theme/src/runtime.ts', import.meta.url)),
      },
      ...names.map((name) => ({
        find: `@epui/${name}`,
        replacement: fileURLToPath(
          new URL(
            `./packages/${name}/src/index.${name === 'adapter-react' ? 'tsx' : 'ts'}`,
            import.meta.url,
          ),
        ),
      })),
    ],
  },
  build: {
    outDir: '../dist/playground',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./playground/index.html', import.meta.url)),
        stress: fileURLToPath(new URL('./playground/stress.html', import.meta.url)),
        api: fileURLToPath(new URL('./playground/api.html', import.meta.url)),
        cdn: fileURLToPath(new URL('./playground/cdn.html', import.meta.url)),
      },
    },
  },
  server: { fs: { allow: ['..'] }, headers: { 'Access-Control-Allow-Origin': '*' } },
  preview: { headers: { 'Access-Control-Allow-Origin': '*' } },
});
