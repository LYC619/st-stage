import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { chromium, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { isolatedReady } from './isolated-browser-ready.mjs'

const args=process.argv.slice(2), opt=key=>args.includes(key)?args[args.indexOf(key)+1]:undefined
assert.ok(args.includes('--isolated-data') && opt('--url'), 'Requires explicitly disposable ST data')
const url=new URL(opt('--url')); assert.ok(['localhost','127.0.0.1'].includes(url.hostname)); assert.notEqual(url.port,'18771')
const out=opt('--output')||'test-results/wechat-social-upgrade/social-browser', candidate=opt('--candidate-root')||'.'
mkdirSync(out,{recursive:true})
const report={build:JSON.parse(readFileSync(candidate+'/version.json')).v,sha256:createHash('sha256').update(readFileSync(candidate+'/bundle.js')).digest('hex'),scope:'Actual isolated ST and native worldbook APIs; intercepted AI; simulated viewports.',scenarios:[]}
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
  for(const size of [{width:1365,height:900},{width:320,height:667},{width:390,height:844},{width:667,height:375}].filter(s=>!opt('--width')||s.width===Number(opt('--width')))) {
    const result={...size,checks:[],scans:[],errors:[]}; report.scenarios.push(result)
    const context=await browser.newContext({viewport:size,isMobile:size.width<700,hasTouch:size.width<700})
    await context.addInitScript(()=>localStorage.setItem('language','zh-cn'))
    const requests=[], books=[]; let held, hold=false
    await context.route('**/*',async route=>{
      const target=new URL(route.request().url())
      if(target.origin!==url.origin)return route.abort()
      if(target.pathname==='/api/worldinfo/get')books.push(route.request().postDataJSON().name)
      if(target.pathname!=='/social-fixture-api')return route.continue()
      const body=route.request().postDataJSON(); requests.push(body)
      const moment=body.messages[0].content.includes('visibility')
      const response=moment?{text:'月港雨停后，收好船票等明天出发。 '+requests.length,visibility:'private'}:{messages:[{type:'text',content:'记得月港的船票，也知道这里的通行规则。'}]}
      const finish=()=>route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:JSON.stringify(response)}}]})}).catch(()=>{})
      if(hold){held=finish;return} await finish()
    })
    const page=await context.newPage(); page.setDefaultTimeout(20000)
    page.on('pageerror',error=>result.errors.push(error.message))
    const data=()=>page.evaluate(()=>window.SillyTavern.getContext().extensionSettings.sprite_overlay.apps['wechat-sister'])
    const save=async fn=>{const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/settings/save'&&r.ok());await Promise.all([fn(),response])}
    async function app(){if(await page.locator('#sprite-overlay-root').isVisible())await page.locator('.sprite-overlay-close').click();if(!await page.locator('.so-phone-shell').isVisible())await page.locator('.so-phone-fab').click();await page.locator('.so-phone-homebtn').click();await page.locator('[data-app-id="wechat-sister"]').click();await page.locator('#wt-conversations').waitFor()}
    async function check(name){
      const bounds=await page.locator('.wechat-root').evaluate(root=>{const b=root.getBoundingClientRect();return {overflow:root.scrollWidth-root.clientWidth,right:b.right,bottom:b.bottom,width:innerWidth,height:innerHeight}})
      assert.ok(bounds.overflow<=2 && bounds.right<=bounds.width+2 && bounds.bottom<=bounds.height+2,JSON.stringify(bounds))
      const axe=await new AxeBuilder({page}).include('.wechat-root').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()
      const compact=rules=>rules.map(rule=>({id:rule.id,nodes:rule.nodes.map(node=>({target:node.target,failureSummary:node.failureSummary}))}))
      result.scans.push({name,violations:compact(axe.violations),incomplete:compact(axe.incomplete)});assert.deepEqual(axe.violations.map(v=>v.id),[])
      await page.screenshot({path:`${out}/${size.width}-${name}.png`});result.checks.push(name+': fits and scoped axe passes')
    }
    try {
      await page.goto(url.href,{waitUntil:'domcontentloaded'});await isolatedReady(page)
      assert.equal(await page.evaluate(async()=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await(await fetch('/scripts/extensions/third-party/baigong-acceptance/bundle.js')).arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('')),report.sha256)
      await page.evaluate(async()=>{
        const ctx=window.SillyTavern.getContext(),post=async(path,body)=>{const r=await fetch(path,{method:'POST',headers:ctx.getRequestHeaders(),body:JSON.stringify(body)});if(!r.ok)throw Error(path+': '+r.status);const text=await r.text();try{return JSON.parse(text)}catch{return text}}
        const all=await post('/api/characters/all',{})
        for(const name of ['Social A','Social B'])if(!all.some(c=>c.name===name))await post('/api/characters/create',{ch_name:name,description:name+' persona',first_mes:'Synthetic story greeting'})
        for(const name of ['Social Bound','Social Main','Social Global','Social Chat'])await post('/api/worldinfo/edit',{name,data:{entries:{
          0:{uid:0,constant:true,content:name+' ALWAYS',comment:'常驻'},
          1:{uid:1,key:['月港'],content:name+' HARBOR',comment:'港口规则'},
          2:{uid:2,constant:true,disable:true,content:'DISABLED_LORE'},
          3:{uid:3,key:['沙漠'],content:'UNMATCHED_LORE'},
        }}})
        const settings=ctx.extensionSettings.sprite_overlay;settings.enabled=false;settings.showPhone=true;settings.phone={x:8,y:8,open:false}
        settings.apps['wechat-sister']={memoryVersion:1,config:{apiKey:'synthetic',apiUrl:location.origin+'/social-fixture-api',model:'fixture',autoMoments:false},conversations:{}}
        await(await import('/script.js')).saveSettings()
      })
      await page.reload({waitUntil:'domcontentloaded'});await isolatedReady(page)
      // Host settings can be ready before the newly created character list is hydrated.
      await page.waitForFunction(()=>['Social A','Social B'].every(name=>window.SillyTavern.getContext().characters.some(card=>card.name===name)))
      await page.evaluate(async()=>{
        let ctx=window.SillyTavern.getContext();const id=ctx.characters.findIndex(c=>c.name==='Social A')
        await(await import('/script.js')).selectCharacterById(id,{switchMenu:false})
        ctx=window.SillyTavern.getContext()
        for(const name of ['Social A','Social B']){
          const index=ctx.characters.findIndex(c=>c.name===name);await ctx.unshallowCharacter(String(index))
          const card=ctx.characters[index];card.data.extensions.world=name==='Social B'?'Social Bound':'Social Main'
        }
        const wi=await import('/scripts/world-info.js');wi.selected_world_info.splice(0,wi.selected_world_info.length,'Social Global')
        ctx.chatMetadata.world_info='Social Chat'
        ctx.chat.splice(0,ctx.chat.length,{name:'旅行者',is_user:true,mes:'我们在月港拿到船票。'},{name:'Social A',is_user:false,mes:'<p>月港的雨停了，明天出发。</p><think>HIDDEN_REASONING</think>'},{is_system:true,mes:'SYSTEM_ONLY'})
      })
      await app();await check('chats')
      await page.locator('#wt-plus').click();await page.keyboard.press('Escape');await expect(page.locator('#wt-plus')).toBeFocused()
      await page.locator('#wt-plus').click();await page.locator('#wt-add-contact').click();await page.locator('#wt-contact-search').fill('Social B');await page.locator('[data-contact]').filter({hasText:'Social B'}).click()
      await page.locator('#wt-input-text').fill('还记得船票和港口的规则吗？');await page.locator('#wt-send-btn').click();await expect(page.locator('#wt-scroll')).toContainText('记得月港的船票')
      const prompt=requests.at(-1).messages[0].content
      for(const value of ['Social B persona','酒馆主线背景 · Social A','旅行者: 我们在月港拿到船票。','Social Bound ALWAYS','Social Global HARBOR','Social Main ALWAYS','Social Chat HARBOR'])assert.ok(prompt.includes(value),value)
      for(const value of ['DISABLED_LORE','UNMATCHED_LORE','HIDDEN_REASONING','SYSTEM_ONLY'])assert.ok(!prompt.includes(value),value)
      for(const name of ['Social Bound','Social Main','Social Global','Social Chat'])assert.ok(books.includes(name),name)
      result.checks.push('actual reply contains recent main story, selected-contact persona and native bound/global/chat lore; disabled/system/thinking/unmatched text excluded')
      await page.locator('#wt-input-text').fill('保留的草稿');await page.locator('#wt-back').click();await page.locator('#wt-tab-chats').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#wt-tab-contacts')).toBeFocused()
      await check('contacts');await page.locator('#wt-address-book [data-friend]').filter({hasText:'Social B'}).click();await expect(page.locator('#wt-input-text')).toHaveValue('保留的草稿')
      await page.locator('#wt-back').click();await expect(page.locator('#wt-tab-contacts')).toHaveAttribute('aria-selected','true')
      result.checks.push('plus menu keyboard dismissal, tab arrows, directory return and per-chat draft retained')
      await page.locator('.so-phone-homebtn').click()
      await page.evaluate(()=>{delete window.SillyTavern.getContext().extensionSettings.sprite_overlay.apps['wechat-sister'].config.autoMoments})
      const before=requests.length;await app();await expect.poll(async()=>(await data()).moments?.length).toBe(2)
      assert.equal(requests.length,before+2);for(const request of requests.slice(before))assert.ok(request.messages[0].content.includes('Social Global HARBOR'))
      await page.locator('#wt-moments').click();await expect(page.locator('.wt-moment-private')).toHaveCount(2);await expect(page.locator('#wt-moments-author')).toBeHidden()
      await page.locator('.wt-moment button[aria-pressed]').first().click();await check('moments')
      result.checks.push('entering WeChat automatically creates two lore-aware posts; full timeline and private badges appear without choosing an author')
      await app();await page.locator('#wt-moments').click();assert.equal((await data()).moments.length,2);assert.equal(requests.length,before+2)
      await page.clock.install();await page.clock.fastForward(120001)
      await page.locator('.so-phone-homebtn').click()
      await page.evaluate(async()=>{const ctx=window.SillyTavern.getContext();ctx.chat.push({name:'Social A',is_user:false,mes:'NEW_STORY_MARKER 我们已经登上了月港的船。'});await ctx.eventSource.emit(ctx.eventTypes.MESSAGE_RECEIVED,ctx.chat.length-1)})
      await expect.poll(async()=>(await data()).moments?.length).toBe(4)
      assert.equal(requests.length,before+4);for(const request of requests.slice(-2))assert.ok(request.messages[0].content.includes('NEW_STORY_MARKER'))
      result.checks.push('re-entry deduplicates; actual host message event generates two new posts while phone app is unmounted')
      await page.clock.resume();await app();await page.locator('#wt-moments').click()
      hold=true;await page.locator('#wt-refresh-moments').click();await expect.poll(()=>typeof held).toBe('function')
      await page.evaluate(async()=>{const ctx=window.SillyTavern.getContext();ctx.extensionSettings.sprite_overlay.apps['wechat-sister'].config.autoMoments=false;await(await import('/script.js')).selectCharacterById(ctx.characters.findIndex(c=>c.name==='Social B'),{switchMenu:false})})
      await expect.poll(()=>page.evaluate(()=>window.SillyTavern.getContext().name2)).toBe('Social B')
      await expect(page.locator('#wt-refresh-moments')).toBeEnabled();hold=false;await held();assert.equal((await data()).moments.length,4)
      result.checks.push('switching the actual main chat cancels pending generation and ignores its late response')
      await page.locator('#wt-settings-btn').click();await page.locator('#wt-moments-composer > summary').click();await page.locator('#wt-auto-moments').uncheck();await page.locator('#wt-private-moments').uncheck();await save(()=>page.locator('#wt-btn-save-settings').click());await page.locator('#wt-close-settings').click()
      await page.reload({waitUntil:'domcontentloaded'});await isolatedReady(page);await app();await page.locator('#wt-moments').click()
      await expect(page.locator('.wt-moment')).toHaveCount(4);await expect(page.locator('.wt-moment button[aria-pressed="true"]')).toHaveCount(1)
      assert.equal((await data()).config.autoMoments,false);assert.equal((await data()).config.privateMoments,false)
      result.checks.push('private posts, likes and opt-out preferences persist across reload')
      assert.deepEqual(result.errors,[]);result.passed=true
    }catch(error){result.failure=error.stack;await page.screenshot({path:`${out}/${size.width}-failure.png`}).catch(()=>{});throw error}
    finally{await context.close();writeFileSync(out+'/report.json',JSON.stringify(report,null,2))}
  }
}finally{await browser.close();writeFileSync(out+'/report.json',JSON.stringify(report,null,2))}
console.log(`Social upgrade: ${report.scenarios.length} scenarios passed`)
