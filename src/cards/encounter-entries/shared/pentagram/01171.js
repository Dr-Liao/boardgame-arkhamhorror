// 01171 神秘咏唱
// 归属：跨战役通用
// 遭遇组：pentagram
// 卡面：显现 - 在最近的一个[[异教徒]]敌人上放置2个毁灭标记。如果场上没有[[异教徒]]敌人，查找遭遇牌库及弃牌堆，从中找出并抽取一个[[异教徒]]敌人(混洗遭遇牌库)。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { hasTrait, ALL_CARDS, entryDistance } from '../../_shared.js'

export default {
  code: '01171', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const cultists = state.enemies.filter(enemy => hasTrait(enemy, 'Cultist'))
    const target = [...cultists].sort((left, right) =>
      entryDistance(state, inv.location, left.location) - entryDistance(state, inv.location, right.location))[0]
    if (target) {
      target.doom = (target.doom || 0) + 2
      api.info?.(`🌑 「${target.name}」上放置 2 点毁灭（当前 ${target.doom}）。`)
      return false
    }
    const isCultist = code => {
      const data = ALL_CARDS[code]
      return data?.type === 'enemy' && (data.traits || []).some(trait => String(trait).toLowerCase() === 'cultist')
    }
    let found = null
    const fromDiscard = state.encounterDiscard.findIndex(isCultist)
    if (fromDiscard >= 0) found = state.encounterDiscard.splice(fromDiscard, 1)[0]
    else {
      const fromDeck = state.encounterDeck.findIndex(isCultist)
      if (fromDeck >= 0) found = state.encounterDeck.splice(fromDeck, 1)[0]
    }
    if (found) {
      for (let index = state.encounterDeck.length - 1; index > 0; index--) {
        const swap = Math.floor((api.random?.() ?? 0) * (index + 1))
        ;[state.encounterDeck[index], state.encounterDeck[swap]] = [state.encounterDeck[swap], state.encounterDeck[index]]
      }
      api.spawn(found, inv.location)
      api.info?.('🔍 神秘咏唱：从遭遇牌堆／弃牌堆找到了一个异教徒。')
    }
    return false
  },
}
