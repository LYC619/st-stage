// ESLint 9 flat config：只管本项目源码（core / st-extension / lib / components / app）
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'index.js', // esbuild 产物
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // 交互式 DOM 代码里空 catch 常用于「尽力而为」逻辑，但必须写注释说明
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // core 层禁止 any（不可信输入必须显式收窄）
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // 阶段二收敛纪律：App UI 文件 0 直连 ST——SillyTavern / window.parent 上的
    // Mvu、酒馆助手 / jQuery 等页面全局，只允许出现在 per-app bridge
    // （apps/*/bridge.ts，照 apps/api/bridge.ts 模式）和 newvar 常驻运行时里
    files: ['st-extension/src/apps/**/*.ts'],
    ignores: ['st-extension/src/apps/*/bridge.ts', 'st-extension/src/apps/newvar/runtime.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'SillyTavern', message: 'ST 耦合收敛到本 App 的 bridge.ts' },
        { object: 'window', property: 'parent', message: '跨窗口全局（Mvu/酒馆助手）只在本 App 的 bridge.ts 里取' },
        { object: 'window', property: 'jQuery', message: 'jQuery 只在本 App 的 bridge.ts 里碰' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "TSAsExpression > Identifier[name='window']",
          message: '不在 App UI 里对 window 做类型断言取页面全局——耦合放本 App 的 bridge.ts',
        },
      ],
    },
  },
)
