import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../e2e',
  use: { baseURL: 'http://127.0.0.1:8000' },
  projects: [
    { name: 'telefon', use: { viewport: { width: 390, height: 844 } } },
    { name: 'laptop', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    cwd: '..',
    command:
      'backend/.venv/bin/uvicorn app.main:app --app-dir backend --host 127.0.0.1',
    url: 'http://127.0.0.1:8000/api/health',
    reuseExistingServer: false,
  },
});
