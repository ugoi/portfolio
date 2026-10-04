import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 60_000, workers: 1,
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:4321', reducedMotion: 'reduce', viewport: { width: 1376, height: 800 },
    launchOptions: {
      executablePath: process.env.CHROMIUM_EXECUTABLE,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
    },
  },
  webServer: { command: 'node --experimental-strip-types tests/browser/server.mjs', port: 4321, reuseExistingServer: false },
});
