import { describe, expect, it } from 'vitest'
import { removeBakedCheckerboard } from './checkerboard-cleanup'

function checkerboard(width: number, height: number, cell = 2): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0 ? 248 : 224
      const offset = (y * width + x) * 4
      data.set([value, value, value, 255], offset)
    }
  }
  return data
}

function setPixel(data: Uint8ClampedArray, width: number, x: number, y: number, rgba: number[]): void {
  data.set(rgba, (y * width + x) * 4)
}

function pixel(data: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  return [...data.slice((y * width + x) * 4, (y * width + x) * 4 + 4)]
}

describe('removeBakedCheckerboard', () => {
  it('只清除与画布边缘连通的两色浅灰棋盘格并保留彩色前景', () => {
    const width = 10
    const height = 10
    const data = checkerboard(width, height)
    for (let y = 3; y <= 6; y += 1) {
      for (let x = 3; x <= 6; x += 1) setPixel(data, width, x, y, [220, 40, 70, 255])
    }

    const result = removeBakedCheckerboard({ data, width, height })

    expect(result).not.toBeNull()
    expect(result!.removedPixels).toBe(84)
    expect(pixel(result!.data, width, 0, 0)).toEqual([248, 248, 248, 0])
    expect(pixel(result!.data, width, 4, 4)).toEqual([220, 40, 70, 255])
    expect(pixel(data, width, 0, 0)).toEqual([248, 248, 248, 255])
  })

  it('保留被彩色前景包围、与边缘不连通的白色高光', () => {
    const width = 9
    const height = 9
    const data = checkerboard(width, height)
    for (let y = 2; y <= 6; y += 1) {
      for (let x = 2; x <= 6; x += 1) setPixel(data, width, x, y, [180, 60, 90, 255])
    }
    setPixel(data, width, 4, 4, [248, 248, 248, 255])

    const result = removeBakedCheckerboard({ data, width, height })

    expect(result).not.toBeNull()
    expect(pixel(result!.data, width, 4, 4)).toEqual([248, 248, 248, 255])
  })

  it('已有透明像素、普通不透明彩色图或无效尺寸都拒绝处理', () => {
    const transparent = checkerboard(4, 4, 1)
    transparent[3] = 80
    expect(removeBakedCheckerboard({ data: transparent, width: 4, height: 4 })).toBeNull()

    const colored = new Uint8ClampedArray(4 * 4 * 4)
    for (let offset = 0; offset < colored.length; offset += 4) {
      colored.set([40 + offset, 80, 160, 255], offset)
    }
    expect(removeBakedCheckerboard({ data: colored, width: 4, height: 4 })).toBeNull()
    expect(removeBakedCheckerboard({ data: colored, width: 3, height: 3 })).toBeNull()
  })
})
