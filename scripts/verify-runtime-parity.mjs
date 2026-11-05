import { option, verifyArtifacts } from './release-artifacts.mjs'

try {
  const files = verifyArtifacts({ root: option('--root'), distribution: option('--distribution'), release: option('--release', false), preview: option('--preview', false) })
  if (process.argv.includes('--verbose')) for (const file of files) console.log(`${file.path} ${file.bytes} bytes sha256=${file.sha256}`)
  console.log(`Artifact parity passed: ${files.length} files (${files.length - 8} WeChat assets), including generated README.`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
