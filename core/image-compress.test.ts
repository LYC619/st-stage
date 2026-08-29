// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  analyzeImagePixels,
  cleanCheckerboardImage,
  estimateDataUriBytes,
  recompressDataUri,
} from './image-compress'

describe('analyzeImagePixels', () => {
  it('检测到任意有效透明像素时判为透明图片', () => {
    expect(analyzeImagePixels(new Uint8ClampedArray([
      255, 255, 255, 255,
      0, 0, 0, 80,
    ]))).toBe('transparent')
  })

  it('识别由两种浅灰主色组成的全不透明棋盘背景', () => {
    const pixels: number[] = []
    for (let index = 0; index < 100; index += 1) {
      const value = index % 2 === 0 ? 248 : 224
      pixels.push(value, value, value, 255)
    }
    expect(analyzeImagePixels(new Uint8ClampedArray(pixels))).toBe('opaque-checkerboard')
  })

  it('普通全不透明彩色图片只报告无透明通道', () => {
    expect(analyzeImagePixels(new Uint8ClampedArray([
      220, 40, 70, 255,
      30, 90, 210, 255,
      180, 120, 50, 255,
    ]))).toBe('opaque')
  })
})

describe('recompressDataUri — 跳过分支', () => {
  it('已是 webp 原样返回（防代际画质损失）', async () => {
    const uri = 'data:image/webp;base64,QUJD'
    expect(await recompressDataUri(uri)).toBe(uri)
  })

  it('GIF/SVG 原样返回（保动画/矢量）', async () => {
    const gif = 'data:image/gif;base64,QUJD'
    const svg = 'data:image/svg+xml;base64,QUJD'
    expect(await recompressDataUri(gif)).toBe(gif)
    expect(await recompressDataUri(svg)).toBe(svg)
  })

  it('非图片 data URI 原样返回', async () => {
    const uri = 'data:application/json;base64,QUJD'
    expect(await recompressDataUri(uri)).toBe(uri)
  })
})

describe('estimateDataUriBytes', () => {
  it('按 base64 编码率 4/3 估算', () => {
    expect(estimateDataUriBytes('data:image/png;base64,QUJD')).toBe(3)
  })
})

describe('cleanCheckerboardImage', () => {
  it('通过可替换编解码器输出透明 PNG Blob', async () => {
    const width = 4
    const height = 4
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = (x + y) % 2 === 0 ? 248 : 224
        data.set([value, value, value, 255], (y * width + x) * 4)
      }
    }
    const encoded = new Blob(['png'], { type: 'image/png' })
    const encodePng = vi.fn(async (cleaned: Uint8ClampedArray, encodedWidth: number, encodedHeight: number) => {
      expect(encodedWidth).toBe(width)
      expect(encodedHeight).toBe(height)
      expect(cleaned[3]).toBe(0)
      return encoded
    })

    const result = await cleanCheckerboardImage(new Blob(['source'], { type: 'image/png' }), {
      decode: vi.fn(async () => ({ data, width, height })),
      encodePng,
    })

    expect(result.blob).toBe(encoded)
    expect(result.removedPixels).toBe(16)
    expect(encodePng).toHaveBeenCalledTimes(1)
  })

  it('像素证据不足时拒绝输出清理文件，并说明需要什么样的图', async () => {
    const data = new Uint8ClampedArray([
      220, 40, 70, 255,
      30, 90, 210, 255,
      180, 120, 50, 255,
      20, 30, 40, 255,
    ])
    const encodePng = vi.fn()
    await expect(cleanCheckerboardImage(new Blob(['source'], { type: 'image/png' }), {
      decode: async () => ({ data, width: 2, height: 2 }),
      encodePng,
    })).rejects.toThrow(/没有在这张图里确认到可安全去除的棋盘格背景.*两级浅灰/s)
    expect(encodePng).not.toHaveBeenCalled()
  })

  // 真机实测的困惑点：拿一张真正的透明 PNG 去试，看到「没有确认到棋盘格」会以为功能坏了。
  // 这两种拒绝必须分开报——前者是「不需要处理」，后者是「不敢处理」。
  it('已带透明通道的图单独报「不需要处理」，不与证据不足混为一谈', async () => {
    const width = 4
    const height = 4
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = (x + y) % 2 === 0 ? 248 : 224
        // 除棋盘格图案外，把一个像素设成半透明：这就是真透明 PNG 的特征
        data.set([value, value, value, y === 0 && x === 0 ? 0 : 255], (y * width + x) * 4)
      }
    }
    const encodePng = vi.fn()
    await expect(cleanCheckerboardImage(new Blob(['source'], { type: 'image/png' }), {
      decode: async () => ({ data, width, height }),
      encodePng,
    })).rejects.toThrow(/已经带透明通道，不需要去棋盘格/)
    expect(encodePng).not.toHaveBeenCalled()
  })
})
