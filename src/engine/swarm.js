// 蜂拥卡（批次 2 原语 `swarm.placeCards`）。
//
// 规则口径：头领（host）放置 Swarming X 张蜂拥卡；蜂拥卡在场上作为独立敌人实体，
// 可独立被攻击、交战和攻击调查员；头领在蜂拥卡全部清空前不能被击败。
// 击败一张蜂拥卡后，可把超出伤害分配给同群另一张蜂拥卡，或在没有蜂拥卡时分给头领。
// X 由 `swarming.js` 求值；本模块只管「放/收/清空/判定」。
//
// 状态形状（只写在蜂拥敌人上）：
//   host.swarmCards = [{ id, code, source, defeated: false }]
// 纯数据：不 import engine；未使用蜂拥的战役不产生字段。

function assertHost(host) {
  if (!host || typeof host !== 'object') throw new Error('swarm 需要头领敌人对象')
  if (host.hostId) throw new Error('蜂拥卡不能作为头领（它自己有 hostId）')
  return host
}

/** 头领身上的蜂拥卡（数组副本，避免调用方改内部结构）。 */
export function swarmCardsOf(host) {
  return Array.isArray(host?.swarmCards) ? host.swarmCards.filter(card => !card.defeated) : []
}

/** 蜂拥卡数量（含已击败的？不——只算仍在场的）。 */
export function swarmCountOf(host) {
  return swarmCardsOf(host).length
}

export function swarmGroup(state, enemy) {
  if (!enemy) return []
  const host = enemy.hostId ? state.enemies.find(item => item.id === enemy.hostId) : enemy
  return host ? [host, ...state.enemies.filter(item => item.hostId === host.id)] : [enemy]
}

export function returnSwarmCard(state, enemy) {
  if (!enemy?.hostId) return false
  const host = state.enemies.find(item => item.id === enemy.hostId)
  const card = host?.swarmCards?.find(item => item.id === enemy.id)
  if (card) card.defeated = true
  const owner = state.investigators?.[enemy.swarmOwnerSeat ?? card?.ownerSeat]
  if (owner && (enemy.underlyingCard || card?.code)) owner.deck.unshift(enemy.underlyingCard || card.code)
  const index = state.enemies.indexOf(enemy)
  if (index >= 0) state.enemies.splice(index, 1)
  for (const inv of state.investigators || []) inv.engaged = (inv.engaged || []).filter(id => id !== enemy.id)
  return true
}

/**
 * 放置 count 张蜂拥卡。`draw()` 必须返回卡号（默认从所属调查员牌库顶抽）。
 * 每张卡生成 `{ id, code, hostId, kind: 'swarm', source }`，推进 `state.instanceSeq`。
 */
export function placeSwarmCards(state, host, count, { draw, source = 'swarming', ownerSeat = null } = {}) {
  assertHost(host)
  const total = Math.max(0, Number(count) || 0)
  if (!total) return []
  const seat = ownerSeat ?? host.swarmOwnerSeat ?? host.engagedSeat ?? state.campaign?.leadSeat ?? state.currentSeat ?? 0
  const owner = state.investigators?.[seat]
  const drawCard = typeof draw === 'function' ? draw : () => owner?.deck.pop() ?? null
  state.instanceSeq ||= {}
  const added = []
  for (let index = 0; index < total; index += 1) {
    const code = drawCard()
    if (!code) break
    const next = (state.instanceSeq.swarm || 0) + 1
    state.instanceSeq.swarm = next
    const card = { id: `swarm${next}`, code, hostId: host.id ?? null, kind: 'swarm', source, defeated: false, ownerSeat: seat }
    host.swarmCards ||= []
    host.swarmCards.push(card)
    added.push(card)
    if (state.enemies?.includes(host)) {
      const copy = { ...host, id: card.id, hostId: host.id, kind: 'swarm', underlyingCard: code, swarmOwnerSeat: seat,
        damageTaken: 0, doom: 0, clues: 0, victory: 0, vengeance: 0, attachments: [], swarmCards: [], swarming: null, pendingSwarmCount: 0 }
      state.enemies.push(copy)
      if (copy.engagedSeat != null && owner) state.investigators[copy.engagedSeat]?.engaged.push(copy.id)
    }
  }
  return added
}

/** 击败/移除一张蜂拥卡；返回是否命中。 */
export function removeSwarmCard(host, swarmId) {
  const cards = Array.isArray(host?.swarmCards) ? host.swarmCards : []
  const card = cards.find(item => item.id === swarmId && !item.defeated)
  if (!card) return false
  card.defeated = true
  return true
}

/** 清空头领的全部蜂拥卡；返回被清掉的 id。 */
export function clearSwarmCards(host) {
  const cards = swarmCardsOf(host)
  for (const card of cards) card.defeated = true
  return cards.map(card => card.id)
}

/** 头领是否可被击败（蜂拥卡全部清空才可）。 */
export function swarmCanBeDefeated(host) {
  return swarmCountOf(host) === 0
}

/** 不可击败的原因（给 UI/日志/测试用；可击败时返回 null）。 */
export function swarmBlockedReason(host) {
  const count = swarmCountOf(host)
  return count > 0 ? `头领仍有 ${count} 张蜂拥卡，清空前不能被击败` : null
}

/** 从任意敌人反查头领（蜂拥卡带 hostId；头领返回自身）。 */
export function swarmHostOf(state, enemy) {
  if (!enemy) return null
  if (!enemy.hostId) return enemy
  const byInstance = (state?.enemies || []).find(candidate =>
    (candidate.swarmCards || []).some(card => card.id === enemy.id))
  if (byInstance) return byInstance
  return (state?.enemies || []).find(candidate => String(candidate.id) === String(enemy.hostId)) || null
}

