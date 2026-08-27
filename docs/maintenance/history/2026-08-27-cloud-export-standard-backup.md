# 2026-08-27 Cloud Export Standard Backup

## Boundary

- Product version remains `0.9.0`.
- Code/build commit: `116103a` (`feat: optimize cloud export standard backups`).
- Build stamp for this batch is `0.9.0+202608271324`.
- The pre-existing root `style.css`, maintenance acceptance-stamp edit, and `pre-release-cargo-target/` directory were preserved rather than treated as Cloud Export source changes.
- Real SillyTavern and STE integration are not claimed as automated evidence.

## Delivered

- Replaced the eager `loadSnapshot()` path with independent character, chat, worldbook, settings, and content methods.
- Opening the App now requests only `/api/characters/all`; other categories load on first visit, chats load on expansion or batch selection, and worldbook/card/chat bodies load only during export.
- Added current-filter select all, invert, and clear controls, plus per-character and category-level character-with-all-chats batch actions.
- Added a bounded export task runner with a maximum of four concurrent asset reads, progress callbacks, asset-labelled errors, and no partial ZIP download on failure.
- Added in-flight chat-list request reuse so expansion and batch selection cannot duplicate a request or lose chat selection.
- Changed the download name to `default-user-YYYYMMDD-HHmmss.zip` while keeping SillyTavern paths at the ZIP root: `settings.json`, `characters/`, `chats/`, `worlds/`, and `OpenAI Settings/`.
- Kept the minimal settings contract, including `extension_settings.regex`, selected worldbook names, and no `secrets.json` or API keys.

## Verification

- Cloud Export focused Vitest: 5 files, 17 tests passed.
- Full Vitest: 78 files, 928 tests passed.
- TypeScript and full ESLint passed.
- Next.js 16.2.6 production build passed after the code/build commit.
- Root and `st-distribution/` artifacts were rebuilt with fixed build time `2026-08-27 13:24`.
- Shared SHA-256 hashes matched:
  - `index.js`: `D0E60A1B546D223922A7FBF01231B79205874963BDFFE4C963BD081347C9B849`
  - `bundle.js`: `C82E97A89E8CC4741A341BECFFAD2967BDCA2283A131874FE792C86D369F7111`
  - `style.css`: `D80B3E4E6FF1F34B014746A7E5311B7E3AAF3B36DE1A1C58EA06073CA7E76971`
  - `version.json`: `A89507A627B03A96E6377AB5B6D5C79F5311169CFB91DB420BD892BD0500DF6C`
- `st-distribution/` contains exactly six install files and no image, `public/`, `reference/`, or preset source directory.
- `git diff --check` passed before the maintenance update.

## Real Integration Next

- Confirm App opening latency with a real account containing many roles, chats, and worldbooks.
- Confirm only the role list request occurs on first open and other requests occur when their category or content is used.
- Use “全选角色及聊天” and mixed-category selection, then verify one `default-user-*.zip` is downloaded.
- Open the ZIP and confirm standard paths are directly at the archive root without an extra `default-user/` wrapper.
- Feed the ZIP to STE and confirm its existing SillyTavern scan/import flow recognizes every selected asset.
