// Compatibility entrypoint. The maintained evolution suite covers the original
// independent-chat scenarios plus groups, Moments, recovery, media and voice.
// Forward all CLI options, including --candidate-root, --output and --width.
console.log('WeChat experience now runs the maintained evolution acceptance suite.')
await import('./verify-wechat-evolution-browser.mjs')
