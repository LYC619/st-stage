import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
if (!process.env.ST_HOST_ENV) throw new Error('Run pnpm test:host; a fresh isolated host is mandatory.');
const env = JSON.parse(readFileSync(process.env.ST_HOST_ENV, 'utf8'));
export default defineConfig({
  testDir: './host-e2e', timeout: 180000, expect: { timeout: 15000 }, fullyParallel: false, workers: 1, retries: 0,
  outputDir: path.join(env.output, 'playwright'),
  reporter: [['list'], ['json', { outputFile: path.join(env.output, 'playwright-results.json') }]],
  use: { baseURL: env.url, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  ],
});
