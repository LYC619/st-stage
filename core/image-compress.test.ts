// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { estimateDataUriBytes, recompressDataUri } from './image-compress'

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
