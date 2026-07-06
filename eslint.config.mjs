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
)
