import { defineConfig, loadEnv } from 'vite';
import jobSearch from './api/job-search.js';
import resumeProfile from './api/resume-profile.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['BRAVE_', 'GEMINI_', 'VITE_SUPABASE_']);
  for (const [key, value] of Object.entries(env)) process.env[key] ??= value;

  function mount(server) {
    server.middlewares.use('/api/job-search', jobSearch);
    server.middlewares.use('/api/resume-profile', resumeProfile);
  }

  return { plugins: [{ name: 'jobbuddy-api', configureServer: mount, configurePreviewServer: mount }] };
});
