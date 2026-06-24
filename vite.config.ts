import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function argPageRewrite() {
  return {
    name: 'arg-page-rewrite',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use((request, _response, next) => {
        if (!request.url) {
          next();
          return;
        }

        const url = new URL(request.url, 'http://localhost');

        if (url.pathname === '/arg' || url.pathname === '/arg/') {
          request.url = `/arg/index.html${url.search}`;
        }

        next();
      });
    },
    configurePreviewServer(server: import('vite').PreviewServer) {
      server.middlewares.use((request, _response, next) => {
        if (!request.url) {
          next();
          return;
        }

        const url = new URL(request.url, 'http://localhost');

        if (url.pathname === '/arg' || url.pathname === '/arg/') {
          request.url = `/arg/index.html${url.search}`;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), argPageRewrite()],
});
