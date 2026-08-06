# ST Stage Generated Distribution

This directory is generated ST installation output.

- Source code lives in `st-extension/` and `core/` in the development repository.
- The generated package contains `manifest.json`, `index.js`, `bundle.js`, `style.css`, and `version.json`.
- Reference images and simulator-only assets are intentionally excluded.
- Regenerate it with `pnpm build:st` using a fixed `ST_STAGE_BUILD_TIME` for reproducible artifacts.
