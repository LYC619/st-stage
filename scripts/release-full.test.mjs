import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { releaseFull } from './release-full.mjs'
import { baseFiles } from './release-artifacts.mjs'
const git = (root,...args) => execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
const put = (root,name,text) => { mkdirSync(path.dirname(path.join(root,name)),{recursive:true});writeFileSync(path.join(root,name),text) }
function fixture(t) {
  const base=mkdtempSync(path.join(os.tmpdir(),'st-release-full-'))
  t.after(()=>{assert.equal(path.dirname(base),os.tmpdir());rmSync(base,{recursive:true,force:true})})
  const root=path.join(base,'source'),release=path.join(base,'install'),sourceRemote=path.join(base,'source.git'),releaseRemote=path.join(base,'install.git'),output=path.join(base,'run')
  for(const repo of [root,release,sourceRemote,releaseRemote])mkdirSync(repo)
  for(const repo of [sourceRemote,releaseRemote])git(repo,'init','--bare','-q','--initial-branch=main')
  for(const [repo,remote]of [[root,sourceRemote],[release,releaseRemote]]) {
    git(repo,'init','-q','--initial-branch=main');git(repo,'config','core.autocrlf','false')
    git(repo,'config','user.name','Release Test');git(repo,'config','user.email','release@example.invalid')
    for(const name of baseFiles)put(repo,name,name+'\n')
    put(repo,'version.json','{"v":"0.9.0+202611050000"}\n');put(repo,'assets/wechat/a.png','image')
    if(repo===root){put(repo,'st-extension/distribution-readme.md','README.md\n');put(repo,'source.ts','implementation\n')}
    git(repo,'add','.');git(repo,'commit','-qm','baseline');git(repo,'remote','add','origin',remote);git(repo,'push','-q','origin','main')
  }
  const build=async()=>{
    put(root,'bundle.js','import("./chunk-ABCDEF01.js");\n');put(root,'chunk-ABCDEF01.js','export const zip = 1;\n')
    put(root,'version.json','{"v":"0.9.0+202611060000"}\n')
    for(const dir of ['st-distribution','public']) {
      for(const file of [...baseFiles,'chunk-ABCDEF01.js','assets/wechat/a.png']) { const dest=path.join(root,dir,file);mkdirSync(path.dirname(dest),{recursive:true});cpSync(path.join(root,file),dest) }
    }
  }
  return {root,release,sourceRemote,releaseRemote,output,build,options:{root,release,sourceRemote,releaseRemote,output}}
}
test('publishes both linear histories with hashed chunks, verified backup, and idempotent resume',async t=>{
  const f=fixture(t), result=await releaseFull({...f.options,publish:true},{checksAndBuild:f.build})
  assert.equal(result.state,'complete');assert.equal(git(f.sourceRemote,'rev-parse','main'),result.sourceCommit)
  assert.equal(git(f.releaseRemote,'rev-parse','main'),result.releaseCommit)
  assert.equal(readFileSync(path.join(f.release,'chunk-ABCDEF01.js'),'utf8'),'export const zip = 1;\n')
  assert.ok(existsSync(path.join(f.output,'backup/originals/bundle.js')))
  assert.equal((await releaseFull({...f.options,publish:true,resume:true})).state,'complete')
})
test('preview only builds a candidate; later publication resumes without rerunning checks',async t=>{
  const f=fixture(t), head=git(f.root,'rev-parse','HEAD')
  const preview=await releaseFull(f.options,{checksAndBuild:f.build})
  assert.equal(preview.state,'prepared');assert.equal(git(f.root,'rev-parse','HEAD'),head)
  assert.equal(git(f.release,'status','--porcelain'),'')
  assert.equal((await releaseFull({...f.options,publish:true,resume:true})).state,'complete')
})
test('a rejected second push resumes without duplicating the successful first push or release commits',async t=>{
  const f=fixture(t), hook=path.join(f.releaseRemote,'hooks/pre-receive')
  writeFileSync(hook,'#!/bin/sh\nexit 1\n',{mode:0o755})
  await assert.rejects(releaseFull({...f.options,publish:true},{checksAndBuild:f.build}),/receipt/)
  const receipt=JSON.parse(readFileSync(path.join(f.output,'release-full.json'),'utf8'))
  assert.equal(receipt.state,'source-pushed');assert.equal(git(f.sourceRemote,'rev-parse','main'),receipt.sourceCommit)
  rmSync(hook)
  const done=await releaseFull({...f.options,publish:true,resume:true})
  assert.equal(done.sourceCommit,receipt.sourceCommit);assert.equal(done.releaseCommit,receipt.releaseCommit);assert.equal(done.state,'complete')
})
test('refuses dirty target and unexpected origin before any build',async t=>{
  const f=fixture(t);let calls=0
  put(f.release,'bundle.js','local')
  await assert.rejects(releaseFull(f.options,{checksAndBuild:async()=>{calls++}}),/clean/)
  assert.equal(calls,0);assert.equal(existsSync(f.output),false)
  await assert.rejects(releaseFull({...f.options,releaseRemote:f.sourceRemote}),/identity/)
})
test('records a failed check and never synchronizes or pushes',async t=>{
  const f=fixture(t),head=git(f.release,'rev-parse','HEAD')
  await assert.rejects(releaseFull({...f.options,publish:true},{checksAndBuild:async()=>{throw Error('check failed')}}),/check failed/)
  assert.equal(git(f.release,'rev-parse','HEAD'),head)
  assert.equal(JSON.parse(readFileSync(path.join(f.output,'release-full.json'),'utf8')).state,'checking')
})
test('rejects remote drift and tampered candidate on resume',async t=>{
  const f=fixture(t);await releaseFull(f.options,{checksAndBuild:f.build})
  put(f.release,'bundle.js','new remote');git(f.release,'add','.');git(f.release,'commit','-qm','other release');git(f.release,'push','-q','origin','main')
  await assert.rejects(releaseFull({...f.options,resume:true,publish:true}),/HEAD differs/)
  put(path.join(f.output,'candidate/package'),'bundle.js','tampered')
  await assert.rejects(releaseFull({...f.options,resume:true,publish:true}),/candidate/)
})
