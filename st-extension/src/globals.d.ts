/** 构建时由 build.mjs 的 esbuild define 注入；直接跑 TS 源码（vitest 等）时不存在，用 typeof 守卫读取 */
declare const __EXT_VERSION__: string
declare const __BUILD_TIME__: string
