import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Controlled recognition events exercise the actual UI without using a microphone or external speech service.
export async function verifyWechatUXPhase2({ page, context, saved, openApp, ready, fit, scan, result, out, size }) {
  await context.unroute('**/wechat-experience-api')
  await page.evaluate(() => {
    window.SpeechRecognition = class {
      constructor() { window.__recognition = this }
      start() { this.started = true }
      stop() { this.onend?.() }
      abort() { this.aborted = true }
    }
  })
  await openApp(); await page.locator('[data-conversation^="direct:"]').filter({ hasText: 'Experience B' }).click()
  await expect(page.locator('#wt-chat-tools')).toBeHidden()
  const shell = page.locator('.so-phone-shell'), toggle = page.locator('#wt-voice-mode'), input = page.locator('#wt-input-text')
  assert.equal(await shell.evaluate(node => node.getBoundingClientRect().width), size.width >= 768 ? 380 : Math.min(320,size.width - 16))
  await input.fill(''); await toggle.click(); await expect(page.locator('#wt-record')).toBeVisible()
  assert.equal(await toggle.evaluate(node => node.parentElement.firstElementChild === node), true)
  await fit('integrated-voice-input'); await scan('voice-ready')
  await page.locator('#wt-record').focus(); await page.keyboard.press('Enter')
  await expect(page.locator('#wt-record')).toHaveText('结束录音'); await expect(page.locator('#wt-send-btn')).toBeDisabled()
  await page.evaluate(() => window.__recognition.onresult({ results: [{ isFinal: false, 0: { transcript: '识别进行中' } }] }))
  const count = await page.locator('.wt-message').count()
  await page.evaluate(() => window.__recognition.onresult({ results: [{ isFinal: true, 0: { transcript: '去湖边走走' } }] }))
  await page.keyboard.press('Enter'); await expect(input).toHaveValue('去湖边走走'); await expect(input).toBeFocused()
  await expect(page.locator('.wt-message')).toHaveCount(count)
  await input.fill('去湖边走走，已确认。')
  await saved(async () => { await page.locator('#wt-send-btn').click(); await expect(page.locator('.wt-message-player .wt-voice')).toHaveCount(1) })
  await expect.poll(() => page.evaluate(() => Object.values(window.SillyTavern.getContext().extensionSettings.sprite_overlay.apps['wechat-sister'].conversations).find(c => c.characterName === 'Experience B').messages.at(-2)?.content)).toBe('去湖边走走，已确认。')
  await toggle.click(); await toggle.click(); await page.locator('#wt-record').click()
  await page.evaluate(() => { window.__oldRecognition = window.__recognition; window.__oldResult = window.__recognition.onresult; window.__oldEnd = window.__recognition.onend })
  await page.locator('#wt-back').click(); assert.equal(await page.evaluate(() => window.__oldRecognition.aborted), true)
  await page.evaluate(() => { window.__oldResult({ results: [{ isFinal: true,0: { transcript: '迟到结果' } }] }); window.__oldEnd() })
  await page.locator('[data-conversation^="direct:"]').filter({ hasText: 'Experience B' }).click(); await expect(input).toHaveValue('')
  await toggle.click(); await page.locator('#wt-record').click(); await page.evaluate(() => window.__recognition.onerror({ error: 'not-allowed' }))
  await expect(input).toBeVisible(); await expect(page.locator('#wt-voice-status')).toContainText('未获授权')
  await scan('voice-denied'); await page.screenshot({ path: `${out}/${size.width}-phase2-voice.png` })
  await page.locator('#wt-back').click(); await page.locator('[data-conversation]').filter({ hasText: '验收群聊' }).click()
  await toggle.click(); await page.locator('#wt-record').click()
  // ArrowDown commits a native select change and the app focuses the composer immediately.
  await page.locator('#wt-mention').focus(); await page.keyboard.press('ArrowDown')
  await expect(input).toBeFocused(); await expect(toggle).toHaveAttribute('aria-pressed','false')
  await expect(input).toHaveValue(/@/); await fit('group-mention-capsule')
  await page.evaluate(() => { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined })
  await openApp(); await page.locator('[data-conversation^="direct:"]').filter({ hasText: 'Experience B' }).click(); await toggle.click()
  await expect(input).toBeVisible(); await expect(page.locator('#wt-voice-status')).toContainText('无法语音识别')
  await input.fill('手动语音草稿'); await toggle.click(); await expect(input).toHaveValue('手动语音草稿')
  result.checks.push('voice: keyboard capture/stop, editable confirmation before send, denied/unsupported fallback and late-result cancellation; @ stays keyboard accessible')

  await page.locator('.so-phone-homebtn').click()
  await saved(() => page.evaluate(() => {
    const ctx = window.SillyTavern.getContext(), data = ctx.extensionSettings.sprite_overlay.apps['wechat-sister'], template = Object.values(data.conversations).find(c => c.conversationType === 'group')
    for (const count of [2,4,5,9]) {
      const members = Array.from({ length: count },(_,i) => { const id = `avatar:mosaic-${i}.png`; data.contacts[id] = { id, name: '成员 ' + i, card: { avatar: `mosaic-${i}.png` } }; return id })
      const key = 'group:mosaic-' + count
      data.conversations[key] = { ...template, scopeKey: key, memberIds: members, title: '头像验收 ' + count, characterName: '头像验收 ' + count, messages: [], updatedAt: Date.now() + count }
    }
    ctx.saveSettingsDebounced()
  }))
  await openApp()
  result.groupAvatars = []
  for (const count of [2,4,5,9]) {
    const row = page.locator(`[data-conversation="group:mosaic-${count}"]`); await row.scrollIntoViewIfNeeded()
    const metrics = await row.evaluate(node => {
      const avatar = node.querySelector('.wt-group-avatar'), title = node.querySelector('.wt-conversation-title'), r = node.getBoundingClientRect()
      return { columns: avatar.dataset.columns, width: avatar.getBoundingClientRect().width, height: avatar.getBoundingClientRect().height, rowHeight:r.height, titleOverflow: title.scrollWidth - title.clientWidth, cells:[...avatar.children].map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})), overflow:node.scrollWidth-node.clientWidth }
    })
    assert.equal(metrics.columns,count <= 4 ? '2':'3'); assert.equal(metrics.width,44); assert.equal(metrics.height,44)
    assert.equal(metrics.cells.length,count); assert.ok(metrics.rowHeight >= 44 && metrics.overflow <= 1 && metrics.titleOverflow <= 1)
    for (const cell of metrics.cells) { assert.equal(cell.width,count <= 4 ? 18:13); assert.equal(cell.height,cell.width) }
    result.groupAvatars.push({count,...metrics})
  }
  await page.locator('#wt-conversations').evaluate(n=>{n.scrollTop=0}); await fit('adaptive-group-avatars'); await scan('adaptive-group-avatars')
  await page.screenshot({path:`${out}/${size.width}-phase2-avatars.png`})
  result.shellWidths=[]
  for (const width of [768,767,320,280,size.width]) {
    await page.setViewportSize({width,height:size.height})
    const expected = Math.min(width >= 768 ? 380:320,width-16)
    await expect.poll(()=>shell.evaluate(n=>n.getBoundingClientRect().width)).toBe(expected)
    const box=await shell.boundingBox(); assert.ok(box.x>=0&&box.x+box.width<=width)
    result.shellWidths.push({viewport:width,width:box.width})
  }
  result.checks.push('avatars: 2/4 members at 18px, 5/9 at 13px with stable rows; shell expands at 768px and reclamps at 320px/280px')

  await page.locator('.so-phone-homebtn').click()
  await page.evaluate(async () => {
    const ctx=window.SillyTavern.getContext(),s=ctx.extensionSettings.sprite_overlay
    s.galleryFoldByRole=false; s.packs=[
      {id:'delete-target',name:'删除验收',sprites:[{tag:'独占',url:'/user/images/ux-delete-exclusive.png'},{tag:'共享',url:'/user/images/ux-delete-shared.png'}]},
      {id:'delete-keep',name:'保留共享',sprites:[{tag:'共享',url:'/user/images/ux-delete-shared.png'}]},
      {id:'delete-record',name:'只删记录',sprites:[{tag:'记录',url:'/user/images/ux-delete-record.png'}]},
    ]
    // Await this fixture's own write, not an earlier debounced UI save response.
    await (await import('/script.js')).saveSettings()
  })
  const deleted=[];let fail=true
  await context.route('**/api/images/delete',route=>{deleted.push(route.request().postDataJSON());return route.fulfill({status:fail?500:200,contentType:'application/json',body:fail?'{}':'{}'})})
  // The manager keeps its own initialized settings object; reload to install the persisted fixture.
  await page.reload({waitUntil:'domcontentloaded'});await ready();await openApp();await page.locator('.so-phone-homebtn').click()
  assert.equal(await page.evaluate(()=>window.SillyTavern.getContext().extensionSettings.sprite_overlay.packs.some(p=>p.id==='delete-target')),true,'deletion fixture persisted')
  await page.locator('[data-app-id="gallery"]').click()
  await page.getByRole('button',{name:'打开立绘包管理',exact:true}).click()
  const manager=page.locator('.so-manager'), dialog=page.locator('.so-delete-dialog')
  await page.locator('.so-pack-card').filter({hasText:'删除验收'}).click()
  const opener=manager.getByRole('button',{name:'删除立绘包',exact:true})
  await opener.focus();await page.keyboard.press('Enter');await expect(dialog).toHaveCount(1)
  await expect(dialog).toContainText('共 1 张');await expect(dialog.getByRole('checkbox')).not.toBeChecked()
  for(const key of ['Tab','Shift+Tab'])for(let i=0;i<4;i++){await page.keyboard.press(key);assert.equal(await dialog.evaluate(n=>n.contains(document.activeElement)),true)}
  const axe=await new AxeBuilder({page}).include('.so-delete-dialog').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze()
  result.scans.push({name:'sprite-delete-confirm',violations:axe.violations,incomplete:axe.incomplete});assert.equal(axe.violations.length,0,JSON.stringify(axe.violations))
  const bounds=await dialog.locator('.so-upload-panel').evaluate(n=>{const b=n.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,overflow:n.scrollWidth-n.clientWidth}})
  assert.ok(bounds.left>=0&&bounds.right<=size.width&&bounds.top>=0&&bounds.bottom<=size.height&&bounds.overflow<=1)
  await page.screenshot({path:`${out}/${size.width}-phase2-delete.png`})
  await page.keyboard.press('Escape');await expect(opener).toBeFocused();assert.equal(deleted.length,0)
  await opener.click();await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'删除',exact:true}).click()
  await expect(manager.locator('.so-toast')).toContainText('图包尚未删除');assert.equal(deleted.length,1)
  fail=false;await opener.click();await dialog.getByRole('checkbox').check();await saved(()=>dialog.getByRole('button',{name:'删除',exact:true}).click())
  await expect(page.locator('.so-pack-card').filter({hasText:'删除验收'})).toHaveCount(0)
  assert.equal(deleted.length,2);assert.ok(deleted.every(body=>JSON.stringify(body).includes('ux-delete-exclusive.png')))
  await page.locator('.so-pack-card').filter({hasText:'只删记录'}).click();await opener.click()
  await saved(()=>dialog.getByRole('button',{name:'删除',exact:true}).click());assert.equal(deleted.length,2)
  await expect(page.locator('.so-pack-card').filter({hasText:'保留共享'})).toHaveCount(1)
  await page.locator('.so-manager-close').click()
  result.checks.push('single deletion panel: Escape/focus, exclusive-file count, partial-failure retention/retry, metadata-only and shared-file protection')
}
