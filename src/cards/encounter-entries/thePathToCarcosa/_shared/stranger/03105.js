// 03105 苍白面具的呼唤
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：stranger
// 卡面：显现 - 如果苍白面具下的男子在场，其按玩家顺序攻击场上每位调查员，无论其当前地点。如果苍白面具下的男子不在场，查找其承受者的牌库和弃牌堆，将其找出并抽取，并混洗其承受者的牌库(即使其承受者已退场，依然结算本效果，查找所有场外区域)。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../../_shared.js'
import { pallidMaskCode } from '../../../_lookup.js'

export default {
  code: '03105', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    const manCode = pallidMaskCode()
    const stranger = state.enemies.find(enemy => originalOf(enemy) === manCode)
    if (stranger) {
      for (const target of state.investigators.filter(item => !item.defeated && !item.resigned)) {
        api.attack(stranger, target)
      }
    } else {
      // 不在场：在承受者的牌库/弃牌堆与全部场外区域找出他，抽取并混洗承受者牌库。
      const bearerId = state.campaign?.records?.pallidMaskBearer
      const owner = state.investigators.find(item => item.id === bearerId)
      const zones = state.scenarioZones || {}
      const piles = [owner?.deck, owner?.discard, zones.setAside, state.removedFromGame,
        state.encounterDeck, state.encounterDiscard].filter(Array.isArray)
      let found = false
      for (const pile of piles) {
        const index = pile.indexOf(manCode)
        if (index < 0) continue
        pile.splice(index, 1)
        found = true
        break
      }
      if (found) {
        api.spawn(manCode, inv.location)
        if (owner) api.shuffleDeck(owner.seat)
      }
    }
    return false
  },
}
