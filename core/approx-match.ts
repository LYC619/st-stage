/**
 * 近似匹配（Finding 2·基础版，默认关闭）：严格寻址失败时，按自然语言描述兜底找一张立绘。
 *
 * 动机：上千张图的大包无法把地址表完整塞进 prompt，作者更想直接写
 * 「丽丽穿着连衣裙和XX逛街」，由扩展自己找到 连衣裙 + 逛街 那张。
 *
 * 设计约束（都是为了「开了不会变坏」）：
 * - **只在 resolveSprite 返回 null 时才跑**。精确命中永远优先，本模块不参与竞争，
 *   所以开启它不可能把原本正确的结果换成别的图。
 * - **只做子串计数，不做分词/编辑距离**。中文没有空格，任何分词都要引入词典或
 *   启发式；基础版宁可召回低一点，也不引入会误判的黑箱。
 * - **打平就放弃**。同分候选 ≥2 时返回 null——猜错一张图比不显示更糟，
 *   用户会以为地址写错了而去改 prompt。
 * - 评分只看「候选地址的词出现在描述里」，不看反向包含：
 *   描述通常比地址长得多，反向包含会让短地址（如「笑」）命中一切。
 *
 * 阈值：至少命中一个 ≥2 字符的词，或两个单字符词。单个单字符词命中不算——
 * 「他」「的」这类字在任何描述里都在。
 */

import type { Sprite, SpritePack } from './types'
import { effectiveSpriteAddress } from './address-policy'

export interface ApproxCandidate {
  sprite: Sprite
  /** 参与打分的地址词：人名、服装、图名 */
  terms: string[]
}

export interface ApproxMatchResult {
  sprite: Sprite
  score: number
  /** 命中的词，供调试与日志 */
  hits: string[]
}

/** 地址三段拆成打分词；空段丢掉。图名再按常见分隔符切一次（「微笑_侧身」→ 微笑 / 侧身）。 */
function addressTerms(role: string, outfit: string, tag: string): string[] {
  const terms: string[] = []
  for (const part of [role, outfit]) {
    const trimmed = part.trim()
    if (trimmed) terms.push(trimmed)
  }
  const tagTrimmed = tag.trim()
  if (tagTrimmed) {
    terms.push(tagTrimmed)
    // 图名内部的分隔符：拆开能让「微笑_侧身」同时被「微笑」和「侧身」的描述命中。
    // 纯数字片段丢掉——编号对语义匹配没有贡献，且极易在描述里偶然出现。
    for (const piece of tagTrimmed.split(/[_\-\s/·、,，.。]+/)) {
      const p = piece.trim()
      if (p && p !== tagTrimmed && !/^\d+$/.test(p)) terms.push(p)
    }
  }
  return [...new Set(terms)]
}

/** 活动包 → 候选表。与 prompt 侧同一套有效地址（含包级继承），避免两边看到的身份不一致。 */
export function buildApproxCandidates(packs: SpritePack[]): ApproxCandidate[] {
  const multiPack = packs.length > 1
  const candidates: ApproxCandidate[] = []
  for (const pack of packs) {
    for (const sprite of pack.sprites) {
      const address = effectiveSpriteAddress(pack, sprite, multiPack)
      const terms = addressTerms(address.role, address.outfit, address.tag)
      if (terms.length > 0) candidates.push({ sprite, terms })
    }
  }
  return candidates
}

/** 一个词的权重：长词更可信；单字符词权重减半，需要两个才够阈值。 */
function termWeight(term: string): number {
  return term.length >= 2 ? 2 : 1
}

const MIN_SCORE = 2

/**
 * 按描述文本近似匹配一张立绘。
 * 返回 null 表示「没有足够可信的候选」或「打平」——调用方应当什么都不显示。
 */
export function approxMatchSprite(
  candidates: ApproxCandidate[],
  description: string,
): ApproxMatchResult | null {
  const text = description.trim()
  if (!text || candidates.length === 0) return null

  let best: ApproxMatchResult | null = null
  let tied = false

  for (const candidate of candidates) {
    let score = 0
    const hits: string[] = []
    for (const term of candidate.terms) {
      if (text.includes(term)) {
        score += termWeight(term)
        hits.push(term)
      }
    }
    if (score < MIN_SCORE) continue
    if (!best || score > best.score) {
      best = { sprite: candidate.sprite, score, hits }
      tied = false
    } else if (score === best.score && candidate.sprite !== best.sprite) {
      tied = true
    }
  }

  // 打平就放弃：宁可不显示，也不猜。
  return best && !tied ? best : null
}

/**
 * 严格寻址 + 近似兜底的组合解析器。两个调用点（悬浮窗、楼层内渲染）共用，
 * 避免「悬浮窗认得这个描述、楼层里认不得」这种两边行为不一致的 bug。
 *
 * enabled=false 时逐字等价于直接调 resolveOne——不建候选表，不做任何多余工作。
 */
export function resolveWithApprox(
  packs: SpritePack[],
  address: string,
  resolveOne: (packs: SpritePack[], address: string) => Sprite | null,
  enabled: boolean,
  candidatesCache?: { current: ApproxCandidate[] | null },
): Sprite | null {
  const exact = resolveOne(packs, address)
  if (exact || !enabled) return exact
  // 惰性建表：一条消息里多个未命中标签只建一次
  if (candidatesCache) {
    candidatesCache.current ??= buildApproxCandidates(packs)
    return approxMatchSprite(candidatesCache.current, address)?.sprite ?? null
  }
  return approxMatchSprite(buildApproxCandidates(packs), address)?.sprite ?? null
}
