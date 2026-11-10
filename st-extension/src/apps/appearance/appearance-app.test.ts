// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PhoneApp, PhoneAppContext } from '../../../../core/phone-registry'
import { createAppearanceApp } from './appearance-app'
import { readAppearance, type AppearanceData } from './pack'
import * as images from '../../../../core/image-compress'

let cleanup = () => {}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren() })
function mount(initial?: AppearanceData) {
  let data = initial || readAppearance(undefined)
  const apply = vi.fn(), saveImage = vi.fn(async () => '/user/images/upload.webp')
  const apps: PhoneApp[] = [{ id: 'alpha', name: '甲', icon: '🍵', mount() {} }, { id: 'beta', name: '乙', icon: '🎈', mount() {} }]
  const app = createAppearanceApp({ applyAppearance: apply, saveImage, listApps: () => apps })
  const ctx = { getAppData: () => data, setAppData: (value: AppearanceData) => { data = value } } as unknown as PhoneAppContext
  app.mount(document.body, ctx); cleanup = () => app.unmount!()
  const input = (label: string) => Array.from(document.querySelectorAll('label')).find(row => row.firstChild?.textContent === label)!.querySelector<HTMLInputElement>('input,textarea,select')!
  const click = (label: string, scope: ParentNode = document) => Array.from(scope.querySelectorAll('button')).find(button => button.textContent === label)!.click()
  return { data: () => data, apply, saveImage, input, click }
}

describe('appearance app', () => {
  it('applies URL wallpaper, all registered app icons, network fonts and resets immediately', async () => {
    const f = mount()
    expect(document.querySelectorAll('.ap-icon-row')).toHaveLength(2)
    f.input('图片网址').value = 'https://example.test/wall.webp'; f.click('应用壁纸网址')
    expect(f.data().wallpaper).toBe('https://example.test/wall.webp'); expect(f.apply).toHaveBeenCalledWith(f.data())
    f.input('甲 emoji').value = '📘'; f.click('应用 emoji', document.querySelector('.ap-icon-row')!)
    expect(f.data().icons.alpha).toEqual({ emoji: '📘' })
    f.input('乙图片网址').value = '/user/images/icon.webp'; f.click('应用图标网址', document.querySelectorAll('.ap-icon-row')[1])
    expect(f.data().icons.beta).toEqual({ image: '/user/images/icon.webp' })
    f.input('字体 CSS 网址').value = 'http://example.test/font.css'; f.input('字体名（font-family）').value = 'Handwriting'; f.click('添加网络字体')
    await vi.waitFor(() => expect(document.querySelector('.ap-status')!.textContent).toContain('https://'))
    expect(f.data().fonts).toHaveLength(0)
    f.input('字体 CSS 网址').value = 'https://example.test/font.css'; f.click('添加网络字体')
    expect(f.data().activeFont).toBe('Handwriting'); expect(f.data().fonts[0].family).toBe('Handwriting')
    f.input('当前字体').value = ''; f.input('当前字体').dispatchEvent(new Event('change'))
    expect(f.data().activeFont).toBe('')
    f.click('恢复默认壁纸'); expect(f.data().wallpaper).toBe('')
    f.click('恢复图标', document.querySelector('.ap-icon-row')!); expect(f.data().icons.alpha).toBeUndefined()
  })
  it('compresses wallpaper and icon uploads to the requested sizes and stores only returned URLs', async () => {
    const compress = vi.spyOn(images, 'compressImage').mockResolvedValue({ dataUri: 'data:image/webp;base64,AAAA', compressed: true, bytes: 3 })
    const f = mount(), file = new File(['picture'], 'picture.png', { type: 'image/png' })
    const upload = (label: string) => { const input = f.input(label); Object.defineProperty(input, 'files', { value: [file], configurable: true }); input.dispatchEvent(new Event('change')) }
    upload('上传图片'); await vi.waitFor(() => expect(f.data().wallpaper).toBe('/user/images/upload.webp'))
    expect(compress).toHaveBeenNthCalledWith(1, file, { maxDimension: 1280 })
    upload('上传甲图标'); await vi.waitFor(() => expect(f.data().icons.alpha.image).toBe('/user/images/upload.webp'))
    expect(compress).toHaveBeenNthCalledWith(2, file, { maxDimension: 128 })
    expect(f.saveImage).toHaveBeenCalledWith('data:image/webp;base64,AAAA'); expect(JSON.stringify(f.data())).not.toContain('base64')
  })
  it('exports to clipboard and download, then imports pasted or file JSON after confirmation', async () => {
    const writeText = vi.fn<(value: string) => Promise<void>>().mockResolvedValue(), create = vi.fn(() => 'blob:pack'), revoke = vi.fn(), download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = revoke })
    const f = mount({ wallpaper: '/wall.webp', icons: {}, fonts: [], activeFont: '' })
    f.click('导出外观包'); await vi.waitFor(() => expect(document.querySelector('.ap-status')!.textContent).toContain('已复制并下载'))
    expect(JSON.parse(writeText.mock.calls[0][0])).toEqual(f.data()); expect(download).toHaveBeenCalledOnce()
    expect(create).toHaveBeenCalledWith(expect.any(Blob)); expect(revoke).toHaveBeenCalledWith('blob:pack')
    const pack = JSON.stringify({ wallpaper: '/new.webp', icons: { alpha: { emoji: '📜' }, unknown: { emoji: 'x' } }, fonts: [], activeFont: '' })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    f.input('粘贴外观包 JSON').value = pack; f.click('导入粘贴的外观包'); expect(f.data().wallpaper).toBe('/wall.webp')
    confirm.mockReturnValue(true); f.click('导入粘贴的外观包'); expect(f.data().icons).toEqual({ alpha: { emoji: '📜' } })
    const file = f.input('选择外观包文件')
    Object.defineProperty(file, 'files', { value: [{ text: async () => JSON.stringify({ wallpaper: '/file.webp' }) }] })
    file.dispatchEvent(new Event('change')); await vi.waitFor(() => expect(f.data().wallpaper).toBe('/file.webp'))
  })
})
