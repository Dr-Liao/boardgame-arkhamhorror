import { randomValue } from './rules-state.js'

// The array remains the public bag. Revealed tokens are physically removed until
// the test ends; sealed/removed tokens and the campaign pool survive JSON saves.
export function initializeChaosBag(state, tokens) {
  if (!state.campaign.chaosBag) state.campaign.chaosBag = [...tokens]
  state.chaosBag = [...state.campaign.chaosBag]
  state.chaos = { revealed: [], sealed: [], removed: [], frames: [] }
  state.sealedTokens = []
}

function zones(state) {
  return state.chaos ||= { revealed: [], sealed: [], removed: [], frames: [] }
}

export function changeChaosBag(state, token, amount, { permanent = false } = {}) {
  if (typeof token !== 'string' || !Number.isSafeInteger(amount)) throw new Error('混乱袋变更无效')
  const update = bag => {
    const copy = [...bag]
    if (amount < 0 && copy.filter(t => t === token).length < -amount) throw new Error('混乱袋中没有足够标记')
    for (let n = 0; n < Math.abs(amount); n++) amount > 0 ? copy.push(token) : copy.splice(copy.indexOf(token), 1)
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
  if (!state.chaosBag.length) throw new Error('混乱袋为空，无法揭示标记')
  const token = state.chaosBag.splice(Math.floor(randomValue(state) * state.chaosBag.length), 1)[0]
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
  for (const token of z.revealed.splice(start)) {
    const consumed = ['bless', 'curse'].includes(token) && remaining.includes(token)
    if (consumed) {
      remaining.splice(remaining.indexOf(token), 1)
      z.removed.push(token)
      const i = state.campaign.chaosBag?.indexOf(token) ?? -1
      if (i >= 0) state.campaign.chaosBag.splice(i, 1)
    } else state.chaosBag.push(token)
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
