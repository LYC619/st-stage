import { option, verifyArtifacts, verifyCommittedArtifacts } from './release-artifacts.mjs'

try {
  const verify = process.argv.includes('--committed') ? verifyCommittedArtifacts : verifyArtifacts
  const files = verify({ root: option('--root'), distribution: option('--distribution'), release: option('--release', false), preview: option('--preview', false) })
  if (process.argv.includes('--verbose')) for (const file of files) console.log(`${file.path} ${file.bytes} bytes sha256=${file.sha256}`)
  console.log(`Artifact parity${process.argv.includes('--committed') ? ' and committed inventory' : ''} passed: ${files.length} files (${files.filter(file => file.path.startsWith('assets/wechat/')).length} WeChat assets), including generated README and runtime chunks.`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
