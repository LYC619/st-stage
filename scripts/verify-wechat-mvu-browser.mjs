// Exit explicitly rather than waiting for dependencies of a retired product contract.
console.error('Retired: WeChat no longer reads/writes MVU state, evaluates stats twice, or maintains an MVU wallet.')
console.error('Use verify-wechat-profile-browser.mjs for the current external-variable isolation contract and verify-variables-browser.mjs for Variables App coverage.')
console.error('Historical real-MVU evidence remains under docs/maintenance/history; reproduction script: scripts/archive/verify-wechat-mvu-legacy.mjs --legacy-contract with its matching historical bundle and installed dependencies.')
process.exitCode = 2
