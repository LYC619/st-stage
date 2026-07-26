import { defineConfig, devices } from '@playwright/test'

/**
 * 移动端 E2E：跑在 Web 模拟器（pnpm dev）上，验证手机壳/App 页/聊天链路
 * 在小屏触摸设备上的真实表现（视口钳位、点按、拖拽、持久化）。
 * 仅用 Chromium（两档移动视口），避免额外下载 WebKit；专用端口 3101 不与日常 dev(3000) 冲突。
 * 运行：pnpm test:mobile
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3101',
  },
  webServer: {
    command: 'pnpm dev -p 3101',
    url: 'http://localhost:3101',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    // 主流安卓机（412×915）
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    // 小屏窄机（360×740）：验证手机壳"窄屏收窄"钳位
    { name: 'mobile-small', use: { ...devices['Galaxy S8'] } },
  ],
})
