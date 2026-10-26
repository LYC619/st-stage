/**
 * 《小登同居生活》“正在输入...”拟真延迟模拟算法
 */

export interface TypingSimulationPlan {
  baseTimeMs: number
  pauses: number[]
  totalDurationMs: number
}

export function planTypingSimulation(replyText: string): TypingSimulationPlan {
  // 基础打字时间：clamp(reply_text.length * 0.08, 0.6, 2.0) 秒
  const len = replyText.length
  let baseSeconds = len * 0.08
  if (baseSeconds < 0.6) baseSeconds = 0.6
  if (baseSeconds > 2.0) baseSeconds = 2.0

  const baseTimeMs = Math.round(baseSeconds * 1000)

  // 拟真思考停顿：0 ~ 2 次停顿，每次 0.25 ~ 0.9 秒
  const pauseCount = Math.floor(Math.random() * 3) // 0, 1, 2
  const pauses: number[] = []
  let totalPauseMs = 0

  for (let i = 0; i < pauseCount; i++) {
    const pauseMs = Math.round((0.25 + Math.random() * 0.65) * 1000)
    pauses.push(pauseMs)
    totalPauseMs += pauseMs
  }

  return {
    baseTimeMs,
    pauses,
    totalDurationMs: baseTimeMs + totalPauseMs,
  }
}

export async function simulateTypingDelay(
  replyText: string,
  onTypingStateChange?: (isTyping: boolean) => void,
): Promise<void> {
  const plan = planTypingSimulation(replyText)
  if (onTypingStateChange) onTypingStateChange(true)

  await new Promise((r) => setTimeout(r, plan.baseTimeMs))

  for (const pauseMs of plan.pauses) {
    await new Promise((r) => setTimeout(r, pauseMs))
  }

  if (onTypingStateChange) onTypingStateChange(false)
}
