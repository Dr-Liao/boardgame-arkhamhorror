import { randomValue } from './rules-state.js'

// The array remains the public bag. Revealed tokens are physically removed until
// the test ends; sealed/removed tokens and the campaign pool survive JSON saves.
export function initializeChaosBag(state, tokens) {
  const freshBag = !Array.isArray(state.campaign.chaosBag) || state.campaign.chaosBag.length === 0
  // P9 修复（并行/分选双线）：campaign-parts 的 setPart 会把非活动线快照载入顶层，
  // 新线首次初始化时 `campaign.chaosBag` 是 `[]`（truthy），旧判空让逐线袋永远保持空袋，
  // 并行启动后 AI 一揭示标记就报「混乱袋为空」。空数组合法与「未初始化」同义。
  if (!Array.isArray(state.campaign.chaosBag) || state.campaign.chaosBag.length === 0) {
    state.campaign.chaosBag = [...tokens]
  }
  if (state.deckMode === 'draft') {
    const key = state.campaign.currentPart || 'main'
    state.campaign.draftGiftBags ||= {}
    if (freshBag || !state.campaign.draftGiftBags[key]) {
      state.campaign.chaosBag.push('+1', '0')
      state.campaign.draftGiftBags[key] = true
    }
  }
  state.chaosBag = [...state.campaign.chaosBag]
  state.chaos = { revealed: [], sealed: [], removed: [], frames: [] }
  state.sealedTokens = []
}

function zones(state) {
  return state.chaos ||= { revealed: [], sealed: [], removed: [], frames: [] }
}

export function changeChaosBag(state, token, amount, { permanent = false } = {}) {
  if (typeof token !== 'string' || !Number.isSafeInteger(amount)) throw new Error('混乱袋变更无效')
  const protectedCount = state.deckMode === 'draft' && ['+1', '0'].includes(token) ? 1 : 0
  const update = bag => {
    const copy = [...bag]
    if (amount < 0 && copy.filter(t => t === token).length < -amount && !protectedCount) throw new Error('混乱袋中没有足够标记')
    for (let n = 0; n < Math.abs(amount); n++) {
      if (amount > 0) copy.push(token)
      else if (copy.filter(t => t === token).length > protectedCount) copy.splice(copy.indexOf(token), 1)
    }
    return copy
  }
  const bag = update(state.chaosBag)
  const campaignBag = permanent ? update(state.campaign.chaosBag) : null
  state.chaosBag = bag
  if (permanent) state.campaign.chaosBag = campaignBag
}

export function beginChaosTest(state) {
  const z = zones(state)
  z.frames.push(z.revealed.length)
  z.orders ||= []
  z.orders.push([...state.chaosBag])
}

function restoreOrder(state, order) {
  const remaining = [...state.chaosBag]
  const sorted = []
  for (const token of order || []) {
    const i = remaining.indexOf(token)
    if (i >= 0) { sorted.push(token); remaining.splice(i, 1) }
  }
  state.chaosBag = [...sorted, ...remaining]
}

export function drawChaosToken(state) {
  let index = -1
  if (Array.isArray(state.debugNextTokens) && state.debugNextTokens.length) {
    const forced = state.debugNextTokens.shift()
    if (!state.debugNextTokens.length) delete state.debugNextTokens
    index = state.chaosBag.indexOf(forced)
    if (index < 0 && typeof forced === 'string') {
      state.chaosBag.push(forced)
      index = state.chaosBag.length - 1
    }
  }
  if (index < 0) {
    if (!state.chaosBag.length) throw new Error('混乱袋为空，无法揭示标记')
    index = Math.floor(randomValue(state) * state.chaosBag.length)
  }
  const token = state.chaosBag.splice(index, 1)[0]
  zones(state).revealed.push(token)
  const test = state.skillTest
  state._resolution?.events.push({ type: 'presentation', kind: 'chaos', token,
    seat: test?.seat, name: state.investigators?.find(inv => inv.seat === test?.seat)?.name,
    skill: test?.skill, difficulty: test?.difficulty, source: test?.source })
  return token
}

export function returnChaosToken(state, token) {
  const z = zones(state)
  const index = z.revealed.lastIndexOf(token)
  if (index < (z.frames.at(-1) ?? 0)) throw new Error('标记未在当前检定揭示')
  z.revealed.splice(index, 1)
  state.chaosBag.push(token)
  restoreOrder(state, z.orders?.at(-1))
}

export function endChaosTest(state, resolved = []) {
  const z = zones(state)
  const start = z.frames.pop()
  if (start === undefined) throw new Error('没有进行中的混乱标记检定')
  const remaining = [...resolved]
  for (const [offset, token] of z.revealed.splice(start).entries()) {
    const retain = state.skillTest?.tokenTreatments?.[start + offset]?.retain === true
    const treated = state.skillTest?.tokenTreatments?.[start + offset]?.resolved === true
    const consumed = !retain && ['bless', 'curse'].includes(token) && (remaining.includes(token) || treated)
    if (consumed) {
      if (remaining.includes(token)) remaining.splice(remaining.indexOf(token), 1)
      z.removed.push(token)
      const i = state.campaign.chaosBag?.indexOf(token) ?? -1
      if (i >= 0) state.campaign.chaosBag.splice(i, 1)
    } else {
      if (retain && remaining.includes(token)) remaining.splice(remaining.indexOf(token), 1)
      state.chaosBag.push(token)
    }
  }
  restoreOrder(state, z.orders?.pop())
}

export function sealChaosToken(state, token, source) {
  const i = state.chaosBag.indexOf(token)
  if (i < 0 || !source) throw new Error('无法封印该标记')
  state.chaosBag.splice(i, 1)
  zones(state).sealed.push({ token, source })
  state.sealedTokens = zones(state).sealed.map(item => item.token)
}

export function releaseChaosTokens(state, source) {
  const z = zones(state)
  const returning = z.sealed.filter(item => item.source === source)
  state.chaosBag.push(...returning.map(item => item.token))
  z.sealed = z.sealed.filter(item => item.source !== source)
  state.sealedTokens = z.sealed.map(item => item.token)
}
