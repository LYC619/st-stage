import { describe, expect, it } from 'vitest'
import { uploadToImgbb } from './imgbb'

/** 造一个假 fetch：记录收到的 FormData，返回指定 JSON */
function fakeFetch(json: unknown, status = 200) {
  const captured: { image?: string; key?: string } = {}
  const impl = (async (_url: unknown, init?: RequestInit) => {
    const form = init?.body as FormData
    captured.image = String(form.get('image'))
    captured.key = String(form.get('key'))
    return { status, json: async () => json } as Response
  }) as typeof fetch
  return { impl, captured }
}

describe('uploadToImgbb（功能①）', () => {
  const okJson = {
    success: true,
    data: { url: 'https://i.ibb.co/x/a.png', image: { filename: 'a.png' } },
  }

  it('成功：返回直链与编号，data: 前缀被剥掉', async () => {
    const { impl, captured } = fakeFetch(okJson)
    const result = await uploadToImgbb('k1', 'data:image/webp;base64,QUJD', impl)
    expect(result).toEqual({ url: 'https://i.ibb.co/x/a.png', code: 'a.png' })
    expect(captured.image).toBe('QUJD') // 裸 base64
    expect(captured.key).toBe('k1')
  })

  it('裸 base64 原样透传', async () => {
    const { impl, captured } = fakeFetch(okJson)
    await uploadToImgbb('k1', 'QUJD', impl)
    expect(captured.image).toBe('QUJD')
  })

  it('imgbb 返回 success:false 时抛错并带原因', async () => {
    const { impl } = fakeFetch({ success: false, error: { message: 'bad key' } })
    await expect(uploadToImgbb('k1', 'QUJD', impl)).rejects.toThrow('bad key')
  })

  it('非 JSON 响应抛 HTTP 状态', async () => {
    const impl = (async () =>
      ({ status: 502, json: async () => Promise.reject(new Error('not json')) }) as unknown as Response) as typeof fetch
    await expect(uploadToImgbb('k1', 'QUJD', impl)).rejects.toThrow('502')
  })

  it('空 Key 直接抛错，不发请求', async () => {
    await expect(uploadToImgbb('  ', 'QUJD')).rejects.toThrow('未配置')
  })
})
