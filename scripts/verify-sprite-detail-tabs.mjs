import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { chromium, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { isolatedReady } from './isolated-browser-ready.mjs'

const args=process.argv.slice(2),opt=key=>args.includes(key)?args[args.indexOf(key)+1]:undefined
assert.ok(args.includes('--isolated-data')&&opt('--url'),'Use explicit isolated data and loopback URL')
const url=new URL(opt('--url'));assert.ok(['localhost','127.0.0.1'].includes(url.hostname));assert.notEqual(url.port,'18771')
const out=opt('--output');assert.ok(out);mkdirSync(out,{recursive:true})
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const report={build:JSON.parse(readFileSync('version.json')).v,sha256:hash(readFileSync('bundle.js')),scenarios:[]}
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
  for(const size of [{width:1365,height:900},{width:320,height:667},{width:390,height:844},{width:667,height:375},{width:320,height:667,english:true}].filter(s=>!opt('--width')||s.width===Number(opt('--width')))) {
    const context=await browser.newContext({viewport:size,isMobile:size.width<700,hasTouch:size.width<700})
    await context.addInitScript(english=>localStorage.setItem('language',english?'en-us':'zh-cn'),!!size.english)
    await context.route('**/*',route=>{
      const target=new URL(route.request().url())
      if(target.origin!==url.origin)return route.abort()
      if(target.pathname.startsWith('/ux-tab-image/'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="180"><rect width="120" height="180" fill="#486c85"/></svg>'})
      return route.continue()
    })
    const page=await context.newPage();page.setDefaultTimeout(20000)
    const result={...size,checks:[],scans:[],errors:[]};report.scenarios.push(result)
    page.on('pageerror',error=>result.errors.push(error.message))
    const text=size.english?{info:'Pack information',basic:'Basic Info',prompt:'Prompt & Notes',name:'Pack name',outfit:'Outfit',save:'Save pack information',open:'Open sprite pack manager'}
      :{info:'包信息',basic:'基本信息',prompt:'提示词扩展',name:'包名',outfit:'服装',save:'保存包信息',open:'打开立绘包管理'}
    async function openManager() {
      if(await page.locator('#sprite-overlay-root').isVisible())await page.locator('.sprite-overlay-close').click()
      if(!await page.locator('.so-phone-shell').isVisible())await page.locator('.so-phone-fab').click()
      await page.locator('.so-phone-homebtn').click();await page.locator('[data-app-id="gallery"]').click()
      await page.getByRole('button',{name:text.open,exact:true}).click()
      await page.locator('.so-pack-card').filter({hasText:'Tab fixture'}).click()
    }
    async function scan(name) {
      const axe=await new AxeBuilder({page}).include('.so-pack-meta').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze()
      result.scans.push({name,violations:axe.violations,incomplete:axe.incomplete});assert.equal(axe.violations.length,0,JSON.stringify(axe.violations))
    }
    try {
      await page.goto(url.href,{waitUntil:'domcontentloaded'});await isolatedReady(page)
      assert.equal(hash(await (await page.request.get(url.origin+'/scripts/extensions/third-party/baigong-acceptance/bundle.js')).body()),report.sha256)
      await page.evaluate(async()=>{
        const ctx=window.SillyTavern.getContext(),s=ctx.extensionSettings.sprite_overlay
        s.enabled=false;s.showPhone=true;s.phone={x:8,y:8,open:false};s.galleryFoldByRole=false
        s.packs=[{id:'tab-fixture',name:'Tab fixture',author:'Author',outfit:'Outfit 0',promptNote:'Initial note',inventoryPrompt:'Initial inventory',outfitNotes:Object.fromEntries(Array.from({length:18},(_,i)=>['Outfit '+i,'Notes '+i])),sprites:Array.from({length:12},(_,i)=>({tag:'Image '+i,url:location.origin+'/ux-tab-image/'+i}))}]
        await (await import('/script.js')).saveSettings()
      })
      await page.reload({waitUntil:'domcontentloaded'});await isolatedReady(page);await openManager()
      const panel=page.locator('.so-pack-meta'),basic=panel.getByRole('tab',{name:text.basic,exact:true}),prompt=panel.getByRole('tab',{name:text.prompt,exact:true}),save=panel.getByRole('button',{name:text.save,exact:true})
      await expect(panel).not.toHaveAttribute('open','')
      const gallery=await page.locator('.so-sprite-grid').first().boundingBox();assert.ok(gallery.y<size.height-50,'gallery visible on entry')
      await panel.locator('summary').click();await expect(basic).toHaveAttribute('aria-selected','true')
      await panel.getByRole('textbox',{name:text.name,exact:true}).fill('Tab fixture edited')
      await panel.getByRole('textbox',{name:text.outfit,exact:true}).fill('New outfit')
      await basic.focus();await page.keyboard.press('ArrowRight');await expect(prompt).toBeFocused()
      await expect(panel.locator('.so-outfit-note-input[data-outfit="New outfit"]')).toHaveCount(1)
      await panel.locator('.so-pack-prompt-note').fill('Edited note')
      await panel.locator('.so-pack-prompt-placement').selectOption('after-list')
      await panel.locator('.so-pack-inventory-prompt').fill('Edited inventory')
      await panel.locator('.so-outfit-note-input[data-outfit="New outfit"]').fill('Edited outfit note')
      await prompt.focus();await page.keyboard.press('Home');await expect(basic).toBeFocused()
      await expect(panel.getByRole('textbox',{name:text.name,exact:true})).toHaveValue('Tab fixture edited')
      await scan('basic');await page.keyboard.press('End');await expect(prompt).toBeFocused()
      await expect(panel.locator('.so-pack-prompt-note')).toHaveValue('Edited note')
      await scan('prompt')
      const dimensions=await panel.evaluate(node=>{
        const body=node.querySelector('.so-collapse-body'),area=node.querySelector('.so-meta-panels'),save=node.querySelector('.so-meta-save-row'),b=body.getBoundingClientRect(),s=save.getBoundingClientRect()
        return {bodyHeight:b.height,contentHeight:area.scrollHeight,viewportHeight:area.clientHeight,saveTop:s.top,saveBottom:s.bottom,overflow:node.scrollWidth-node.clientWidth}
      })
      assert.ok(dimensions.bodyHeight<=Math.min(300,size.height*.35)+2&&dimensions.contentHeight>dimensions.viewportHeight)
      assert.ok(dimensions.saveBottom<=size.height&&dimensions.saveTop>=0&&dimensions.overflow<=1,JSON.stringify(dimensions))
      const expandedGallery=await page.locator('.so-sprite-grid').first().boundingBox()
      if(size.height>=600)assert.ok(expandedGallery.y<=size.height-60,'gallery remains visible with metadata expanded')
      await panel.locator('.so-meta-panels').evaluate(n=>{n.scrollTop=n.scrollHeight})
      const after=await save.boundingBox();assert.ok(after.y>=0&&after.y+after.height<=size.height)
      await expect(save).toBeInViewport();result.dimensions=dimensions
      await page.screenshot({path:`${out}/${size.width}-${size.english?'en':'zh'}-prompt.png`})
      await save.click();await expect(prompt).toHaveAttribute('aria-selected','true');await expect(panel).toHaveAttribute('open','')
      const saved=await page.evaluate(async()=>{await(await import('/script.js')).saveSettings();return window.SillyTavern.getContext().extensionSettings.sprite_overlay.packs.find(p=>p.id==='tab-fixture')})
      assert.equal(saved.name,'Tab fixture edited');assert.equal(saved.promptNote,'Edited note');assert.equal(saved.inventoryPrompt,'Edited inventory');assert.equal(saved.promptNotePlacement,'after-list');assert.equal(saved.outfitNotes['New outfit'],'Edited outfit note')
      await panel.locator('summary').click();await page.locator('.so-manager-back').click();await page.locator('.so-pack-card').filter({hasText:'Tab fixture edited'}).click();await expect(panel).not.toHaveAttribute('open','')
      result.checks.push('collapsed entry shows gallery','keyboard tabs preserve unsaved fields and outfit drafts','tab panels have names and zero axe violations','long notes scroll within bounded region while save stays visible','one save commits both tabs and retains expansion/selected tab','collapse preference survives detail re-entry')
      await page.reload({waitUntil:'domcontentloaded'});await isolatedReady(page);await openManager();await panel.locator('summary').click();await expect(panel.getByRole('textbox',{name:text.name,exact:true})).toHaveValue('Tab fixture edited');await prompt.click();await expect(panel.locator('.so-pack-prompt-note')).toHaveValue('Edited note')
      result.checks.push('saved edits survive reload');assert.deepEqual(result.errors,[]);result.passed=true
    }catch(error){result.failure=error.stack;await page.screenshot({path:`${out}/${size.width}-failure.png`}).catch(()=>{});throw error}
    finally{await context.close();writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n')}
  }
}finally{await browser.close()}
console.log(`Sprite detail tabs: ${report.scenarios.length} scenarios passed`)
