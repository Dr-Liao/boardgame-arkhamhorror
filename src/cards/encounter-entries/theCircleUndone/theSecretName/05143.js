// 05143 好事魔宠（Meddlesome Familiar）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：显现 - 布朗·詹金不在场则找出并生成在你地点且你受 1 伤；否则找鼠群与你交战，然后你受 1 伤。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
//
// 参考 MeddlesomeFamiliar.hs：findEncounterCard（遭遇牌库 + 遭遇弃牌堆）找到才生成，
// 伤害在生成后无条件结算。布朗·詹金在遭遇牌库（setup 不再把他放 set aside）。
import { originalOf } from '../../_shared.js'

const findInEncounter = (state, wanted) => {
  const target = String(wanted)
  const discardIndex = state.encounterDiscard.findIndex(code => String(code) === target)
  if (discardIndex >= 0) return state.encounterDiscard.splice(discardIndex, 1)[0]
  const deckIndex = state.encounterDeck.findIndex(code => String(code) === target)
  if (deckIndex >= 0) return state.encounterDeck.splice(deckIndex, 1)[0]
  return null
}

export default {
  code: '05143', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const jenkin = state.enemies.find(enemy => String(originalOf(enemy)) === '05148')
    if (!jenkin) {
      // 卡面：找出布朗·詹金并生成在你所在地点，然后你受到 1 点伤害（伤害无条件）。
      const found = findInEncounter(state, '05148')
      if (found) api.spawn?.(found, inv.location)
      api.damage?.(inv.seat, 1)
      api.info?.(`🐀 「好事魔宠」：找出布朗·詹金并放在 ${inv.name} 所在地点，${inv.name} 受到 1 点伤害。`)
      return false
    }
    // 卡面：找出鼠群并与你交战，然后你受到 1 点伤害；找不到时不凭空生成。
    const rats = findInEncounter(state, '01159')
    const spawned = rats ? (api.spawn?.(rats, inv.location) || null) : null
    if (spawned) api.engage?.(spawned, inv.seat)
    api.damage?.(inv.seat, 1)
    api.info?.('🐀 「好事魔宠」：找出鼠群与你交战，然后你受到 1 点伤害。')
    return false
  },
}
