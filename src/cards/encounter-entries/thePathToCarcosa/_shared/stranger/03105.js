// 03105 苍白面具的呼唤
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：stranger
// 卡面：显现 - 如果苍白面具下的男子在场，其按玩家顺序攻击场上每位调查员，无论其当前地点。如果苍白面具下的男子不在场，查找其承受者的牌库和弃牌堆，将其找出并抽取，并混洗其承受者的牌库(即使其承受者已退场，依然结算本效果，查找所有场外区域)。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf, shuffleDeckWith } from '../../../_shared.js'
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
      // 调查员对象没有 `id` 字段：承受者记录里存的是战役调查员 ID，对应 `campaignId`。
      const bearerId = state.campaign?.records?.pallidMaskBearer
      const owner = state.investigators.find(item => item.campaignId === bearerId || item.id === bearerId)
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
        // 「抽取」= 按 03059 的生成规则放到「距离所有调查员最远的地点」。
        // scenarioRuntime 的 spawn 带 ignoreSpawn，不会自动套用该规则，这里自行计算。
        const alive = state.investigators.filter(item => !item.defeated && !item.resigned)
        let best = -1
        let farthest = []
        for (const location of state.locations) {
          let nearest = Infinity
          for (const witness of alive) {
            const distance = api.locationDistance?.(witness.location, [location.id])
            if (typeof distance === 'number' && distance >= 0 && distance < nearest) nearest = distance
          }
          if (!Number.isFinite(nearest)) continue
          if (nearest > best) { best = nearest; farthest = [location.id] }
          else if (nearest === best) farthest.push(location.id)
        }
        const spawnAt = farthest.length > 1
          ? api.choose({
            kind: 'location', source: manCode, seat: inv.seat,
            prompt: '苍白面具下的男子生成：选择距离所有调查员最远的地点。',
            options: farthest.map(id => ({ id, label: api.locName?.(id) || id })),
          })
          : farthest[0]
        api.spawn(manCode, spawnAt || inv.location)
        if (owner) shuffleDeckWith(state, owner, api)
      }
    }
    return false
  },
}
