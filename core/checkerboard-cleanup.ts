export interface CheckerboardImageData {
  data: Uint8ClampedArray
  width: number
  height: number
}

export interface CheckerboardCleanupResult {
  data: Uint8ClampedArray
  removedPixels: number
  palette: [number, number]
}

interface PaletteBin {
  value: number
  count: number
}

function pixelOffset(index: number): number {
  return index * 4
}

function grayscaleValue(data: Uint8ClampedArray, index: number): number | null {
  const offset = pixelOffset(index)
  const red = data[offset]
  const green = data[offset + 1]
  const blue = data[offset + 2]
  if (Math.max(red, green, blue) - Math.min(red, green, blue) > 6) return null
  return Math.round((red + green + blue) / 3)
}

function edgeIndices(width: number, height: number): number[] {
  const indices: number[] = []
  for (let x = 0; x < width; x += 1) indices.push(x)
  for (let y = 1; y < height - 1; y += 1) indices.push(y * width + width - 1)
  if (height > 1) {
    for (let x = width - 1; x >= 0; x -= 1) indices.push((height - 1) * width + x)
  }
  for (let y = height - 2; y >= 1; y -= 1) indices.push(y * width)
  return indices
}

function detectPalette(data: Uint8ClampedArray, width: number, height: number): [number, number] | null {
  const edges = edgeIndices(width, height)
  const bins = new Map<number, number>()
  for (const index of edges) {
    const value = grayscaleValue(data, index)
    if (value === null || value < 160) continue
    const bin = Math.round(value / 4) * 4
    bins.set(bin, (bins.get(bin) ?? 0) + 1)
  }
  const dominant: PaletteBin[] = [...bins.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
  if (dominant.length !== 2) return null
  const difference = Math.abs(dominant[0].value - dominant[1].value)
  const combined = dominant[0].count + dominant[1].count
  if (
    dominant[0].count / edges.length < 0.1 ||
    dominant[1].count / edges.length < 0.1 ||
    combined / edges.length < 0.6 ||
    difference < 8 ||
    difference > 64
  ) return null
  return dominant[0].value < dominant[1].value
    ? [dominant[0].value, dominant[1].value]
    : [dominant[1].value, dominant[0].value]
}

function matchesPalette(data: Uint8ClampedArray, index: number, palette: [number, number]): boolean {
  const value = grayscaleValue(data, index)
  return value !== null && Math.min(Math.abs(value - palette[0]), Math.abs(value - palette[1])) <= 6
}

/**
 * Remove only edge-connected pixels matching a verified two-tone light-gray palette.
 * The source array is never mutated. Returning null means the evidence was not strong
 * enough for an automatic cleanup.
 */
export function removeBakedCheckerboard(
  image: CheckerboardImageData,
): CheckerboardCleanupResult | null {
  const { data, width, height } = image
  const total = width * height
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 2 ||
    height < 2 ||
    data.length !== total * 4
  ) return null
  for (let offset = 3; offset < data.length; offset += 4) {
    if (data[offset] < 250) return null
  }

  const palette = detectPalette(data, width, height)
  if (!palette) return null
  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0
  const enqueue = (index: number) => {
    if (visited[index] || !matchesPalette(data, index, palette)) return
    visited[index] = 1
    queue[tail++] = index
  }
  for (const index of edgeIndices(width, height)) enqueue(index)

  while (head < tail) {
    const index = queue[head++]
    const x = index % width
    const y = Math.floor(index / width)
    if (x > 0) enqueue(index - 1)
    if (x + 1 < width) enqueue(index + 1)
    if (y > 0) enqueue(index - width)
    if (y + 1 < height) enqueue(index + width)
  }
  if (tail < Math.max(4, Math.ceil(total * 0.15))) return null

  const output = new Uint8ClampedArray(data)
  for (let index = 0; index < total; index += 1) {
    if (visited[index]) output[pixelOffset(index) + 3] = 0
  }
  return { data: output, removedPixels: tail, palette }
}
