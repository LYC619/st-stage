// Current settings and external-variable isolation contract, against actual isolated ST.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { chromium, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { isolatedReady } from './isolated-browser-ready.mjs'

const args=process.argv.slice(2),option=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined
assert.ok(option('--url')&&args.includes('--isolated-data'),'Requires an explicit disposable ST URL')
const url=new URL(option('--url'));assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&!url.username&&!url.password);assert.notEqual(url.port,'18771')
const output=option('--output')||'test-results/wechat-profile-browser',candidate=option('--candidate-root')||'.',measureOnly=args.includes('--measure-only')
mkdirSync(output,{recursive:true})
const report={build:JSON.parse(readFileSync(candidate+'/version.json')).v,sha256:createHash('sha256').update(readFileSync(candidate+'/bundle.js')).digest('hex'),scope:'Actual isolated ST, synthetic profiles/gallery, intercepted AI and instrumented variable boundary. Not real AI/MVU-provider acceptance.',scenarios:[]}
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true})
try{
  for(const size of [{width:1365,height:900},{width:320,height:667},{width:390,height:844},{width:667,height:375}].filter(s=>!option('--width')||s.width===Number(option('--width')))){
    const result={...size,checks:[],scans:[],errors:[]};report.scenarios.push(result)
    const context=await browser.newContext({viewport:size,isMobile:size.width<700,hasTouch:size.width<700})
    await context.addInitScript(()=>localStorage.setItem('language','zh-cn'))
    const requests=[]
    await context.route('**/*',async route=>{
      const target=new URL(route.request().url());if(target.origin!==url.origin)return route.abort()
      if(target.pathname!=='/profile-fixture-api')return route.continue()
      requests.push(route.request().postDataJSON())
      await route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:JSON.stringify({messages:[{type:'text',content:'设置验收回复'}],mood:64,current_status:'在月港等船'})}}]})})
    })
    const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>result.errors.push(e.message))
    const appData=()=>page.evaluate(()=>window.SillyTavern.getContext().extensionSettings.sprite_overlay.apps['wechat-sister'])
    const save=async action=>{const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/settings/save'&&r.ok());await Promise.all([action(),response])}
    const settings=()=>page.locator('#wt-settings-btn').click()
    const close=()=>page.locator('#wt-close-settings').click()
    async function openApp(){if(await page.locator('#sprite-overlay-root').isVisible())await page.locator('.sprite-overlay-close').click();if(!await page.locator('.so-phone-shell').isVisible())await page.locator('.so-phone-fab').click();await page.locator('.so-phone-homebtn').click();await page.locator('[data-app-id="wechat-sister"]').click();await page.locator('#wt-conversations').waitFor()}
    async function disclosure(text){const summary=page.getByText(text,{exact:true});if(!await summary.evaluate(n=>n.parentElement.open))await summary.click()}
    async function scan(name){const axe=await new AxeBuilder({page}).include('.wechat-root').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();const compact=rules=>rules.map(r=>({id:r.id,nodes:r.nodes.map(n=>({target:n.target,failureSummary:n.failureSummary}))}));result.scans.push({name,violations:compact(axe.violations),incomplete:compact(axe.incomplete)});assert.equal(axe.violations.length,0,JSON.stringify(result.scans.at(-1)));await page.screenshot({path:`${output}/${size.width}-${name}.png`})}
    try{
      await page.goto(url.href,{waitUntil:'domcontentloaded'});await isolatedReady(page)
      assert.equal(await page.evaluate(async()=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await(await fetch('/scripts/extensions/third-party/baigong-acceptance/bundle.js')).arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('')),report.sha256)
      await page.evaluate(async()=>{
        const ctx=window.SillyTavern.getContext(),post=async(endpoint,body)=>{const r=await fetch(endpoint,{method:'POST',headers:ctx.getRequestHeaders(),body:JSON.stringify(body)});if(!r.ok)throw Error(endpoint+': '+r.status);const value=await r.text();try{return JSON.parse(value)}catch{return value}}
        const all=await post('/api/characters/all',{})
        for(const name of ['Profile A','Profile B'])if(!all.some(c=>c.name===name))await post('/api/characters/create',{ch_name:name,description:name+' persona',first_mes:'PROFILE_STORY_MARKER'})
        const bytes=new Uint8Array(await(await fetch('/img/user-default.png')).arrayBuffer()),upload=await post('/api/images/upload',{image:btoa(String.fromCharCode(...bytes)),format:'png',ch_name:'profile_followup',filename:'fixture'})
        const data=ctx.extensionSettings.sprite_overlay;data.enabled=false;data.showPhone=true;data.phone={x:8,y:8,open:false}
        data.packs=[{id:'profile-gallery',name:'设置验收图库',sprites:Array.from({length:600},(_,i)=>({tag:'素材 '+i,url:upload.path}))}]
        data.apps['wechat-sister']={memoryVersion:1,config:{apiKey:'synthetic-key',apiUrl:location.origin+'/profile-fixture-api',model:'fixture',autoMoments:false,profile:{preset:'general',contextMessageCount:0,includeWorldbook:false}},conversations:{}}
        await(await import('/script.js')).saveSettings()
      })
      await page.reload({waitUntil:'domcontentloaded'});await isolatedReady(page)
      await page.waitForFunction(()=>['Profile A','Profile B'].every(name=>window.SillyTavern.getContext().characters.some(card=>card.name===name)))
      await page.evaluate(async()=>{const ctx=window.SillyTavern.getContext();await(await import('/script.js')).selectCharacterById(ctx.characters.findIndex(c=>c.name==='Profile A'),{switchMenu:false})})
      await openApp()
      result.performance=await page.evaluate(()=>{
        const initiallyBuilt=!!document.querySelector('.wt-profile-settings'),samples=[]
        for(let i=0;i<6;i++){const start=performance.now();document.querySelector('#wt-settings-btn').click();document.querySelector('#wt-settings-modal').getBoundingClientRect();samples.push(performance.now()-start);document.querySelector('#wt-close-settings').click()}
        return {gallerySize:600,initiallyBuilt,openMs:samples,coldOpenMs:samples[0],warmMedianMs:[...samples.slice(1)].sort((a,b)=>a-b)[2],hiddenAssetImages:document.querySelectorAll('.wt-asset-grid img').length,hiddenGalleryOptions:document.querySelector('[aria-label="从图库选择图片"]')?.children.length??0}
      })
      if(measureOnly){result.passed=true;continue}
      assert.equal(result.performance.initiallyBuilt,false);assert.equal(result.performance.hiddenAssetImages,0);assert.equal(result.performance.hiddenGalleryOptions,0)
      result.checks.push('settings form and 600-item gallery defer work until used')
      await page.locator('#wt-plus').click();await page.locator('#wt-add-contact').click();await page.locator('#wt-contact-search').fill('Profile B');await page.locator('[data-contact]').filter({hasText:'Profile B'}).click()
      await settings();await page.getByLabel('用户称呼（可留空）',{exact:true}).fill('小王')
      await page.getByLabel('联系人显示名（留空跟随角色卡）',{exact:true}).fill('陈墨 <测试>')
      await save(()=>page.locator('#wt-btn-save-settings').click());await close()
      await expect(page.locator('#wt-contact-name')).toHaveText('陈墨 <测试>');assert.equal(await page.locator('#wt-contact-name > *').count(),0)
      await settings();await page.getByLabel('用户称呼（可留空）',{exact:true}).fill('不保存');await close();await settings();await expect(page.getByLabel('用户称呼（可留空）',{exact:true})).toHaveValue('小王')
      await page.locator('[data-profile-scope]').selectOption('character');await page.getByLabel('联系人显示名（留空跟随角色卡）',{exact:true}).fill('B 专用')
      await disclosure('场景模板 · 保存、导入与导出');await page.getByLabel('模板名称',{exact:true}).fill('验收模板');await save(()=>page.getByRole('button',{name:'保存为模板',exact:true}).click())
      assert.equal((await appData()).config.characterProfiles,undefined)
      await page.getByRole('button',{name:'导出当前表单',exact:true}).click();const exported=await page.getByLabel('模板 JSON（粘贴导入或复制导出）',{exact:true}).inputValue();assert.ok(!exported.includes('synthetic-key'));assert.ok(exported.includes('B 专用'))
      await save(()=>page.locator('#wt-btn-save-settings').click());await close()
      await expect(page.locator('#wt-contact-name')).toHaveText('B 专用');assert.equal((await appData()).config.profile.contactName,'陈墨 <测试>')
      result.checks.push('global/character settings, discard, escaped names and template export preserve scope and exclude credentials')
      await settings();await page.getByRole('button',{name:'此联系人改用通用设置',exact:true}).click();await save(()=>page.locator('#wt-btn-save-settings').click());await close();await expect(page.locator('#wt-contact-name')).toHaveText('陈墨 <测试>')
      await settings();await disclosure('表情与图片 · 预览、分组与图库');await expect(page.getByLabel('从图库选择图片',{exact:true}).locator('option').filter({hasText:'设置验收图库 · 素材 '})).toHaveCount(600)
      await page.getByLabel('从图库选择图片',{exact:true}).selectOption({label:'设置验收图库 · 素材 0'});await page.getByRole('button',{name:'添加图库图片',exact:true}).click();await page.getByLabel('素材显示名',{exact:true}).fill('船票表情')
      await page.getByText('表情与图片 · 预览、分组与图库',{exact:true}).click();await disclosure('表情与图片 · 预览、分组与图库');await expect(page.getByLabel('素材显示名',{exact:true})).toHaveValue('船票表情')
      await save(()=>page.locator('#wt-btn-save-settings').click());await scan('assets');await close()
      await page.locator('#wt-emoji-btn').click();await page.locator('#wt-emoji-grid button[aria-label="船票表情"]').click();await expect(page.locator('#wt-send-btn')).toBeEnabled();await expect(page.locator('#wt-scroll img[alt="船票表情"]')).toBeVisible()
      result.checks.push('lazy gallery is editable, survives collapse, saves and sends a snapshot')
      // Install counters after entering the app: the phone home summary has its own legitimate variable reader.
      await page.evaluate(()=>{window.__profileVariables={reads:0,writes:0};const read=()=>{window.__profileVariables.reads++;return {stat_data:{mood:99,money:98765}}},write=()=>{window.__profileVariables.writes++};window.TavernHelper={getVariables:read,replaceVariables:write,insertOrAssignVariables:write};window.Mvu={getMvuData:read,replaceMvuData:write}})
      const before=requests.length
      await page.locator('#wt-input-text').fill('PROFILE_ONE_REQUEST');await page.locator('#wt-send-btn').click();await expect.poll(()=>requests.length).toBe(before+1);await expect(page.locator('#wt-send-btn')).toBeEnabled()
      assert.ok(!JSON.stringify(requests.at(-1)).includes('PROFILE_STORY_MARKER'));assert.ok(JSON.stringify(requests.at(-1)).includes('小王'))
      await page.locator('#wt-packet-btn').click();await page.locator('#wt-custom-amt').fill('一张船票');await page.locator('#wt-confirm-packet').click();await expect.poll(()=>requests.length).toBe(before+2);await expect(page.locator('#wt-send-btn')).toBeEnabled()
      assert.deepEqual(await page.evaluate(()=>window.__profileVariables),{reads:0,writes:0})
      result.checks.push('reply/state use one request; gifts and replies do not read or write external MVU variables')
      await settings();await disclosure('AI 连接 · 已配置 fixture');await page.locator('#wt-cfg-url').fill('javascript:bad');await page.locator('#wt-btn-save-settings').click();await expect(page.locator('#wt-settings-feedback')).toContainText('未保存');assert.ok((await appData()).config.apiUrl.endsWith('/profile-fixture-api'));await close()
      await settings();await disclosure('主线记忆与世界书');await expect(page.getByLabel('读取最近主聊天条数（0 为关闭，最多 20）',{exact:true})).toHaveValue('0');await page.getByLabel('读取最近主聊天条数（0 为关闭，最多 20）',{exact:true}).fill('2');await save(()=>page.locator('#wt-btn-save-settings').click());await scan('settings');await close()
      await page.locator('#wt-input-text').fill('读取主线');await page.locator('#wt-send-btn').click();await expect(page.locator('#wt-send-btn')).toBeEnabled();assert.ok(JSON.stringify(requests.at(-1)).includes('PROFILE_STORY_MARKER'))
      await page.reload({waitUntil:'domcontentloaded'});await isolatedReady(page);await openApp();await page.locator('[data-conversation^="direct:"]').filter({hasText:'陈墨 <测试>'}).filter({hasText:'设置验收回复'}).click()
      await settings();await disclosure('主线记忆与世界书');await expect(page.getByLabel('读取最近主聊天条数（0 为关闭，最多 20）',{exact:true})).toHaveValue('2');await expect(page.locator('[data-profile-scope]')).toHaveValue('global');await close();await scan('chat')
      result.checks.push('invalid saves preserve valid config; memory opt-out/opt-in and profile settings persist across reload')
      assert.deepEqual(result.errors,[]);result.passed=true
    }catch(error){result.failure=error.stack;await page.screenshot({path:`${output}/${size.width}-failure.png`}).catch(()=>{});throw error}
    finally{await context.close();writeFileSync(output+'/report.json',JSON.stringify(report,null,2))}
  }
}finally{await browser.close();writeFileSync(output+'/report.json',JSON.stringify(report,null,2))}
console.log(`WeChat settings: ${report.scenarios.length} scenarios passed${measureOnly?' (performance measurement only)':''}`)
