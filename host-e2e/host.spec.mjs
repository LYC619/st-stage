import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
const env = JSON.parse(readFileSync(process.env.ST_HOST_ENV, 'utf8'));

async function ready(page) {
  await expect.poll(async () => {
    const onboarding = page.locator('dialog[open]').filter({ has: page.locator('.onboarding') });
    if (await onboarding.isVisible()) await onboarding.locator('.popup-button-ok').click();
    return page.evaluate(async () => (await import('/script.js')).settingsReady);
  }, { timeout: 45000 }).toBe(true);
  await page.locator('.so-phone-fab').waitFor({ state: 'attached' });
}
async function saved(page, action, endpoint = '/api/settings/save') {
  const response = page.waitForResponse(r => new URL(r.url()).pathname === endpoint && r.ok(), { timeout: 20000 });
  await action(); await response;
}

async function navigate(page, reload = false) {
  const initialized = page.waitForEvent('console', { predicate: msg => msg.text() === 'Event emitted: app_ready', timeout: 45000 });
  if (reload) await page.reload({ waitUntil: 'domcontentloaded' }); else await page.goto('/', { waitUntil: 'domcontentloaded' });
  await ready(page); await initialized;
}
async function openChat(page, name, chat) {
  await page.evaluate(async ({ name, chat }) => {
    const ctx = window.SillyTavern.getContext();
    const id = ctx.characters.findIndex(c => c.name === name);
    if (id < 0) throw new Error('Synthetic character not found');
    if (Number(ctx.characterId) !== id) await (await import('/script.js')).selectCharacterById(id, { switchMenu: false });
    await window.SillyTavern.getContext().openCharacterChat(chat);
  }, { name, chat });
  await expect.poll(() => page.evaluate(() => window.SillyTavern.getContext().chatId)).toBe(chat);
}
async function app(page, id, mobile) {
  if (await page.locator('#sprite-overlay-root').isVisible()) await page.locator('.sprite-overlay-close').click();
  if (!await page.locator('.so-phone-shell').isVisible()) await page.locator('.so-phone-fab')[mobile ? 'tap' : 'click']();
  await page.locator('.so-phone-homebtn')[mobile ? 'tap' : 'click']();
  await page.locator(`.so-phone-app-icon[data-app-id="${id}"]`)[mobile ? 'tap' : 'click']();
  await expect(page.locator('.so-phone-app-container')).not.toBeEmpty();
}
async function bounds(locator) {
  let latest = null;
  await expect.poll(async () => {
    latest = await locator.evaluate(node => {
      const r = node.getBoundingClientRect(), v = visualViewport;
      return {
        x: r.x - v.offsetLeft,
        y: r.y - v.offsetTop,
        right: r.right - v.offsetLeft,
        bottom: r.bottom - v.offsetTop,
        width: v.width,
        height: v.height,
        sw: node.scrollWidth,
        cw: node.clientWidth,
      };
    });
    return (
      latest.x >= -1 &&
      latest.y >= -1 &&
      latest.right <= latest.width + 1 &&
      latest.bottom <= latest.height + 1 &&
      latest.sw <= latest.cw + 1
    );
  }, { timeout: 5000 }).toBe(true);
  return latest;
}
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);

test('real host release acceptance', async ({ page, request }, info) => {
  test.setTimeout(300000); page.setDefaultTimeout(20000);
  const errors = [], consoleMessages = [], failedRequests = [], checks = [], dependencyReads = [], cdn = new Map();
  const evidence = { browser: page.context().browser().version(), events: null, disk: null, apps: [] };
  const mobile = info.project.name === 'mobile', name = 'Host Acceptance ' + info.project.name, chat = 'Host-' + info.project.name;
  const shot = label => page.screenshot({ path: path.join(env.output, `${info.project.name}-${label}.png`) });
  const pass = label => { checks.push(label); console.log(`${info.project.name}: ${label}`); };
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (['error', 'warning'].includes(msg.type())) consoleMessages.push(msg.text()); });
  page.on('requestfailed', req => failedRequests.push({ url: req.url(), reason: req.failure()?.errorText }));
  page.on('response', response => {
    if (/\.jsdelivr\.net\//.test(response.url()) && response.ok()) dependencyReads.push(response.body().then(body => cdn.set(response.url(), createHash('sha256').update(body).digest('hex'))).catch(error => failedRequests.push({ url: response.url(), reason: error.message })));
  });
  await page.addInitScript(() => localStorage.setItem('language', 'zh-cn'));
  try {
    await navigate(page);
    await saved(page, () => page.evaluate(async ({ modelUrl, project }) => {
      const ctx = window.SillyTavern.getContext();
      const result = await fetch('/api/characters/create', { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify({ ch_name: 'Host Acceptance ' + project, first_mes: 'Synthetic greeting.' }) });
      if (!result.ok) throw new Error('Create character: ' + result.status);
      window.TavernHelper.replaceScriptTrees([{ type: 'script', enabled: true, name: 'MVU acceptance', id: 'mvu-host-acceptance', content: `import '${location.origin}/mvu-acceptance/bundle.js';`, info: '', button: { enabled: true, buttons: [] }, data: {}, export_with: { data: true, button: true } }], { type: 'global' });
      Object.assign(ctx.chatCompletionSettings, { chat_completion_source: 'custom', custom_url: modelUrl, custom_model: 'host-acceptance', stream_openai: true });
      ctx.extensionSettings.sprite_overlay.showPhone = true;
      ctx.extensionSettings.sprite_overlay.phone = { x: 8, y: 8, open: false };
      ctx.saveSettingsDebounced();
    }, { modelUrl: env.modelUrl, project: info.project.name }));
    await navigate(page, true);
    await page.waitForFunction(() => !!window.TavernHelper && !!window.Mvu, null, { timeout: 60000 });
    expect(await page.evaluate(() => typeof window.Mvu.getMvuData)).toBe('function');
    const runtimeFiles = readdirSync(env.release).filter(n => /^(bundle\.js|index\.js|style\.css|version\.json|manifest\.json|chunk-.*\.js)$/.test(n))
      .concat(['assets', 'locales'].flatMap(dir => walk(path.join(env.release, dir)).map(file => path.relative(env.release, file).replaceAll('\\', '/'))));
    for (const file of runtimeFiles) {
      const response = await page.request.get(`/scripts/extensions/third-party/baigong-acceptance/${file}`);
      expect(response.ok(), file).toBe(true);
      expect(createHash('sha256').update(await response.body()).digest('hex'), file).toBe(createHash('sha256').update(readFileSync(path.join(env.release, file))).digest('hex'));
    }
    pass(`real ST/helper/MVU initialized; ${runtimeFiles.length} mounted runtime resources match extension distribution`);
    await openChat(page, name, chat);
    let imageUrls;
    await saved(page, async () => {
      imageUrls = await page.evaluate(async name => {
        const ctx = window.SillyTavern.getContext(), settings = ctx.extensionSettings.sprite_overlay;
        const upload = async (label, color) => {
          const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 360;
          const c = canvas.getContext('2d'); c.fillStyle = color; c.fillRect(0, 0, 240, 360); c.fillStyle = '#fff'; c.font = '24px sans-serif'; c.fillText(label, 24, 180);
          const response = await fetch('/api/images/upload', { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify({ image: canvas.toDataURL().split(',')[1], format: 'png', ch_name: name, filename: label }) });
          if (!response.ok) throw new Error('Upload failed'); return '/' + (await response.json()).path.replace(/^\//, '');
        };
        const first = await upload('Smile', '#28536b'), second = await upload('Night', '#674165');
        Object.assign(settings, { enabled: true, spriteDisplayMode: 'inline', hideTagInMessage: false, variableHud: false, phone: { x: 8, y: 8, open: false },
          packs: [{ id: 'host-day', name: 'Day', roleName: '阿岚', outfit: '日常', coverTag: '微笑', sprites: [{ tag: '微笑', url: first }] }, { id: 'host-night', name: 'Night', roleName: '阿岚', outfit: '夜装', sprites: [{ tag: '微笑', url: second }] }],
          bindings: [{ characterName: name, packIds: ['host-day', 'host-night'], enabled: true }] });
        settings.apps.renderer = { enabled: true, cardsEnabled: true, galEnabled: true, battleEnabled: true, typewriter: false };
        settings.apps.newvar = { enabled: false };
        ctx.saveSettingsDebounced(); return { first, second };
      }, name);
    });
    await navigate(page, true); await openChat(page, name, chat);
    await page.waitForFunction(() => !!window.Mvu);
    await saved(page, () => page.evaluate(async () => {
      const schema = { type: 'object', properties: { 状态: { type: 'object', properties: { 体力: { type: 'number' }, 心情: { type: 'string' }, 行囊: { type: 'array', elementType: { type: 'number' } } } } } };
      await window.Mvu.replaceMvuData({ schema, stat_data: { 状态: { 体力: 20, 心情: '平静', 行囊: [1, 2, 3] } }, display_data: {}, delta_data: {}, initialized_lorebooks: {} }, { type: 'message', message_id: 'latest' });
      await window.SillyTavern.getContext().saveChat();
    }), '/api/chats/save');
    await app(page, 'mvu', mobile);
    const leaf = page.locator('[data-variable-focus="leaf:状态.体力"]');
    await expect(leaf).toContainText('20');
    await page.locator('[data-variable-focus="leaf:状态.行囊"]').click();
    await page.locator('.vm-edit-input').fill('[invalid'); await page.locator('[data-variable-focus="save:状态.行囊"]').click();
    await expect(page.locator('.vm-add-err[role=alert]:visible')).toContainText('JSON');
    await page.locator('.vm-edit-input').fill('[4,5,6]');
    await saved(page, () => page.locator('[data-variable-focus="save:状态.行囊"]').click(), '/api/chats/save');
    await leaf.click();
    await page.locator('.vm-edit-input').fill('37');
    await saved(page, () => page.locator('[data-variable-focus="save:状态.体力"]').click(), '/api/chats/save');
    await expect(leaf).toContainText('37');
    expect(await page.evaluate(() => window.Mvu.getMvuData({ type: 'message', message_id: 'latest' }).stat_data.状态.体力)).toBe(37);
    await shot('mvu-edit'); pass('MVU actual API → editor → validation/recovery → saved message variables');
    await page.locator('.so-phone-close').click();
    await page.evaluate(() => {
      const ctx = window.SillyTavern.getContext(); window.__hostEvents = { tokens: [], received: 0, ended: 0, mvu: 0 };
      ctx.eventSource.on(ctx.eventTypes.STREAM_TOKEN_RECEIVED, text => window.__hostEvents.tokens.push(text));
      ctx.eventSource.on(ctx.eventTypes.MESSAGE_RECEIVED, () => window.__hostEvents.received++);
      ctx.eventSource.on(ctx.eventTypes.GENERATION_ENDED, () => window.__hostEvents.ended++);
      ctx.eventSource.on(window.Mvu.events.VARIABLE_UPDATE_ENDED, () => window.__hostEvents.mvu++);
      window.$('#main_api').val('openai').trigger('change');
      window.$('#api_button_openai').trigger('click');
    });
    await page.waitForFunction(() => window.SillyTavern.getContext().onlineStatus !== 'no_connection');
    const cards = '<STStageRender>' + JSON.stringify({ version: 1, mode: 'cards', title: '真实宿主路线', cards: [{ id: 'road', title: '沿山路前进', description: '检查路标', action: '我选择山路。', branch: '山路通往营地。' }, { id: 'camp', title: '返回营地', description: '休整', action: '我返回营地。' }] }) + '</STStageRender>';
    const reply = 'STREAM ACCEPTANCE\n[立绘:阿岚/日常/微笑]\n' + cards + "\n<UpdateVariable>_.set('状态.体力', 61);</UpdateVariable>";
    await request.post(env.modelUrl.replace('/v1', '/control'), { data: { reply } });
    const generated = page.waitForResponse(r => new URL(r.url()).pathname === '/api/backends/chat-completions/generate' && r.ok());
    await page.locator('#send_textarea').fill('请继续验收剧情。'); await page.locator('#send_but').click(); await generated;
    await expect.poll(() => page.evaluate(() => window.__hostEvents.ended)).toBeGreaterThan(0);
    await expect(page.locator('#chat .st-render-card').first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.Mvu.getMvuData({ type: 'message', message_id: 'latest' }).stat_data?.状态?.体力)).toBe(61);
    const events = await page.evaluate(() => window.__hostEvents);
    evidence.events = { ...events, tokens: events.tokens.length };
    expect(events.tokens.length).toBeGreaterThan(3); expect(events.received).toBeGreaterThan(0); expect(events.mvu).toBeGreaterThan(0);
    const sprite = page.locator('#chat .so-inline-image img').last(); await expect(sprite).toHaveAttribute('src', imageUrls.first);
    await expect.poll(() => sprite.evaluate(img => img.complete && img.naturalWidth)).toBe(240);
    await shot('stream-render');
    const beforeChoice = await page.evaluate(() => window.SillyTavern.getContext().chat.length);
    await page.locator('#chat .st-render-card-select').first().click();
    await expect(page.locator('#send_textarea')).toHaveValue('我选择山路。');
    expect(await page.evaluate(() => window.SillyTavern.getContext().chat.length)).toBe(beforeChoice);
    await app(page, 'mvu', mobile); await expect(leaf).toContainText('61');
    pass('native Generate → HTTP SSE → streaming events → cards/sprite/MVU auto-refresh; card action only fills draft');
    await navigate(page, true); await openChat(page, name, chat); await page.waitForFunction(() => !!window.Mvu);
    await app(page, 'mvu', mobile); await expect(leaf).toContainText('61');
    const diskSettings = JSON.parse(readFileSync(path.join(env.data, 'default-user/settings.json'), 'utf8'));
    expect(diskSettings.extension_settings.sprite_overlay.packs[0].sprites[0].url).toBe(imageUrls.first);
    const chatFiles = walk(path.join(env.data, 'default-user/chats')).filter(f => path.basename(f) === chat + '.jsonl');
    expect(chatFiles.length).toBe(1);
    const diskChat = readFileSync(chatFiles[0], 'utf8').trim().split('\n').map(line => JSON.parse(line));
    expect(diskChat.at(-1).variables[diskChat.at(-1).swipe_id ?? 0].stat_data.状态.体力).toBe(61);
    evidence.disk = { chat: chatFiles[0], variable: 61, sprite: imageUrls.first };
    await openChat(page, name, chat + '-other'); await expect(leaf).toHaveCount(0);
    await openChat(page, name, chat); await expect(leaf).toContainText('61');
    pass('settings/chat files persisted; reload and chat switching preserve/isolate MVU');

    // Real helper API writes messages and emits native host rendering events.
    await page.locator('.so-phone-close').click();
    let imageFailures = 0;
    const imageRoute = new URL(imageUrls.second, env.url).href;
    await page.route(imageRoute, route => { imageFailures++; return route.fulfill({ status: 503, body: 'controlled temporary image failure' }); });
    await page.evaluate(async () => { await window.TavernHelper.createChatMessages([{ role: 'assistant', message: '[立绘:阿岚/夜装/微笑]\n<STStageRender>{broken-json}</STStageRender>' }]); });
    const failedImage = page.locator('#chat .so-inline-image').last();
    await expect(failedImage).toHaveClass(/so-inline-image-error/);
    expect(imageFailures).toBeGreaterThan(0);
    await page.unroute(imageRoute);
    await failedImage.click();
    await expect(failedImage).not.toHaveClass(/so-inline-image-error/);
    await expect.poll(() => failedImage.locator('img').evaluate(img => img.complete && img.naturalWidth)).toBe(240);
    expect(new URL(await failedImage.locator('img').getAttribute('src'), env.url).pathname).toBe(new URL(imageUrls.second, env.url).pathname);
    await expect(page.locator('#chat .mes_text').last()).toContainText('{broken-json}');
    await page.evaluate(async cards => { await window.TavernHelper.createChatMessages([{ role: 'assistant', message: cards }]); }, cards);
    await expect(page.locator('#chat .mes').last().locator('.st-render-card')).toHaveCount(2);
    pass('role/outfit/tag resolves correct pack; image HTTP failure retries; malformed renderer falls back and next valid message recovers');

    await app(page, 'appearance', mobile);
    const hostStyle = () => page.locator('#send_textarea').evaluate(node => { const s = getComputedStyle(node); return [s.fontFamily, s.fontSize, s.color, s.backgroundColor, s.position]; });
    const originalStyle = await hostStyle();
    await page.getByLabel('粘贴外观包 JSON', { exact: true }).fill('{bad');
    await page.getByRole('button', { name: '导入粘贴的外观包', exact: true }).click();
    await expect(page.locator('.ap-status')).not.toHaveText('');
    await saved(page, () => page.locator('.ap-theme-chip').nth(1).click());
    await expect(page.locator('.ap-theme-chip').nth(1)).toHaveClass(/is-active/);
    expect(await hostStyle()).toEqual(originalStyle);
    await shot('appearance'); pass('appearance invalid JSON recovery/theme interaction; host input styles unchanged');

    await page.locator('.so-phone-homebtn').click();
    const ids = await page.locator('.so-phone-app-icon').evaluateAll(nodes => nodes.map(n => n.dataset.appId));
    evidence.apps = ids;
    expect(ids.length).toBe(13);
    for (const id of ids) {
      await app(page, id, mobile); await bounds(page.locator('.so-phone-shell')); await bounds(page.locator('.so-phone-screen'));
      const content = page.locator('.so-phone-app-container');
      expect(await content.evaluate(n => n.scrollWidth <= n.clientWidth + 1), `${id} horizontal overflow`).toBe(true);
      const lastControl = content.locator('button:visible,input:visible,select:visible,summary:visible').last();
      if (await lastControl.count()) { await lastControl.scrollIntoViewIfNeeded(); await expect(lastControl).toBeInViewport(); }
    }
    pass('all 13 built-in apps mount through real clicks/taps without overflow');
    await app(page, 'gallery', mobile);
    const dict = JSON.parse(readFileSync('st-extension/locales/zh-CN.json', 'utf8'));
    await page.getByRole('button', { name: dict.apps.gallery.open_manager, exact: true }).click();
    await expect(page.locator('.so-manager')).toBeVisible(); await bounds(page.locator('.so-manager-header')); await shot('gallery-dialog');
    await page.keyboard.press('Escape'); await expect(page.locator('.so-phone-shell')).toBeVisible();
    await expect(page.locator('.so-manager')).toHaveCount(0);
    await page.locator('.so-phone-homebtn').click();
    const originalSize = page.viewportSize();
    await page.setViewportSize({ width: 320, height: 480 }); await bounds(page.locator('.so-phone-shell')); await shot('short-viewport');
    const cdp = await page.context().newCDPSession(page);
    const viewportMeta = await page.locator('meta[name=viewport]').getAttribute('content');
    if (mobile) {
      // ST itself disables mobile pinch zoom. Verify that policy, then emulate the
      // browser accessibility option that overrides it before restoring viewport size so Blink refreshes constraints.
      expect(viewportMeta).toContain('user-scalable=no');
      evidence.mobileZoomPolicy = viewportMeta;
      await page.locator('meta[name=viewport]').evaluate(node => node.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes'));
    }
    await page.setViewportSize(originalSize);
    await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1.5 });
    await expect.poll(() => page.evaluate(() => visualViewport.scale)).toBe(1.5);
    await bounds(page.locator('.so-phone-shell')); await shot('zoom');
    await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 }); await cdp.detach();
    if (mobile) {
      await page.locator('meta[name=viewport]').evaluate((node, content) => node.setAttribute('content', content), viewportMeta);
      await page.setViewportSize(originalSize);
    }
    await page.locator('.so-phone-close')[mobile ? 'tap' : 'click']();
    await expect(page.locator('.so-phone-shell')).toBeHidden();
    await page.locator('.so-phone-fab')[mobile ? 'tap' : 'click'](); await expect(page.locator('.so-phone-shell')).toBeVisible();
    await shot('home'); pass('gallery modal layering/Escape, 320×480 resize, 150% visual viewport zoom, phone open/close');

    // Story mini-apps use actual MVU and actual metadata persistence, not a web adapter.
    await openChat(page, name, chat + '-apps');
    await saved(page, () => page.evaluate(async () => {
      const schema = { type: 'object', properties: {} };
      await window.Mvu.replaceMvuData({ schema, initialized_lorebooks: {}, stat_data: { 时间: { 年: 2026, 月: 11, 日: 24 }, 位置: { 地点: '验收营地' }, 任务: [{ id: 'route', 标题: '检查山路', 描述: '确认路线', 状态: '进行中' }] } }, { type: 'message', message_id: 'latest' });
      await window.SillyTavern.getContext().saveChat();
    }), '/api/chats/save');
    await app(page, 'story-state', mobile);
    await expect(page.locator('.ss-root')).toContainText('验收营地');
    await page.getByRole('tab', { name: '任务', exact: true }).click();
    await expect(page.locator('.ss-quest')).toContainText('检查山路');
    await page.locator('#send_textarea').fill('');
    await page.getByRole('button', { name: '推进', exact: true }).click();
    expect(await page.locator('#send_textarea').inputValue()).toContain('检查山路');
    await app(page, 'chronicle', mobile); await page.getByRole('tab', { name: '日历', exact: true }).click();
    await expect(page.locator('.ch-cal-toolbar')).toContainText('2026-11-24');
    await page.getByLabel('2026-11-24 当日约定', { exact: true }).fill('山路会合');
    await saved(page, () => page.locator('.ch-day[data-today="true"]').getByRole('button', { name: '记下', exact: true }).click(), '/api/chats/save');
    await page.locator('.ch-day[data-today="true"]').getByRole('button', { name: '📖 看这天日记', exact: true }).click();
    await expect(page.locator('.so-phone-status-title')).toHaveText('小剧场');
    await expect(page.getByRole('tab', { name: '日记', exact: true })).toHaveAttribute('aria-selected', 'true');
    await shot('story-mini-apps');
    await navigate(page, true); await openChat(page, name, chat + '-apps'); await page.waitForFunction(() => !!window.Mvu);
    await app(page, 'chronicle', mobile); await page.getByRole('tab', { name: '日历', exact: true }).click();
    await expect(page.getByLabel('2026-11-24 当日约定', { exact: true })).toHaveValue('山路会合');
    await app(page, 'wechat-sister', mobile); await page.locator('#wt-conversations .wt-conversation').first().click();
    await page.locator('#wt-input-text').fill('手机里保留的草稿');
    await page.locator('.so-phone-close')[mobile ? 'tap' : 'click']();
    await app(page, 'wechat-sister', mobile);
    if (await page.locator('#wt-conversations').isVisible()) await page.locator('#wt-conversations .wt-conversation').first().click();
    await expect(page.locator('#wt-input-text')).toHaveValue('手机里保留的草稿');
    pass('story-state reads real MVU and fills draft; calendar note persists across reload; diary deep link and WeChat draft survive phone reopen');
    expect(errors).toEqual([]);
    expect(consoleMessages.filter(m => m.includes('[st-stage]'))).toEqual([]);
  } finally {
    await Promise.allSettled(dependencyReads);
    writeFileSync(path.join(env.output, info.project.name + '-diagnostics.json'), JSON.stringify({ checks, evidence, errors, consoleMessages, failedRequests, cdn: Object.fromEntries(cdn) }, null, 2));
  }
});
