import { defineConfig, loadEnv } from 'vite';
import jobSearch from './api/job-search.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'BRAVE_SEARCH_API_KEY');
  process.env.BRAVE_SEARCH_API_KEY ??= env.BRAVE_SEARCH_API_KEY ?? '';
  return {
    plugins: [{
      name: 'job-search-api',
      configurePreviewServer(server) {
        server.middlewares.use('/api/job-search', jobSearch);
      },
      configureServer(server) {
        server.middlewares.use('/api/job-search', jobSearch);
      },
    }],
  };
});
