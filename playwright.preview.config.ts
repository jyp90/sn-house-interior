import { defineConfig, devices } from '@playwright/test';

// 배포와 같은 base 경로(/sn-house-interior/)로 빌드한 번들을 vite preview로 띄워 확인한다(배포 설계 §10).
export default defineConfig({
  testDir: 'e2e-preview',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5181/sn-house-interior/',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 5181 --strictPort',
    url: 'http://localhost:5181/sn-house-interior/',
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
