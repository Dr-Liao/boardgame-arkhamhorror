// 05129 屋主的住处（Landlord’s Quarters）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：强制 - 揭示后查找遭遇牌库/弃牌堆找鼠群生成在发霉的走道；闹鬼同效果。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

const isEnemyCode = code => ALL_CARDS[code]?.type === 'enemy'
// 查找遭遇牌库与遭遇弃牌堆（卡面：查找 encounter deck/discard pile）。牌库顶 = 数组尾。
const findInEncounter = (api, predicate) => {
  // 卡面：先查遭遇牌库（牌库顶 = 数组尾）再查弃牌堆；读写收口到 api。
  const deck = api.encounterDeckCards?.() || []
  for (let index = deck.length - 1; index >= 0; index--) {
    if (!predicate(deck[index])) continue
    api.takeEncounterDeckCard?.(deck[index])
    return deck[index]
  }
  const discard = api.encounterDiscardCards?.() || []
  for (let index = discard.length - 1; index >= 0; index--) {
    if (!predicate(discard[index])) continue
    api.takeEncounterDiscard?.(discard[index])
    return discard[index]
  }
  return null
}
const spawnFromAside = (state, api, code, locationId) => {
  if (!locationId) return null
  api.takeFromSetAside?.(code)
  return api.spawn?.(code, locationId) || null
}
const traitsOf = card => (ALL_CARDS[originalOf(card)]?.traits || card?.traits || []).map(trait => String(trait).toLowerCase())
const hasTrait = (card, trait) => traitsOf(card).includes(String(trait).toLowerCase())

export default {
  code: '05129', scope: 'location', implemented: true,
  locationRule: {
    onReveal(state, location, api) {
      const code = findInEncounter(api, candidate => String(candidate) === '01159')
      // 卡面是「查找」，找不到时没有效果；不得从场外凭空生成第 4 张鼠群。
      if (!code) {
        api.info?.('🐀 屋主的住处：遭遇牌库与弃牌堆里没有「鼠群」，本次没有效果。')
        return
      }
      const target = state.locations.find(entry => String(originalOf(entry)) === '05128')?.id
      spawnFromAside(state, api, code, target)
      api.shuffleEncounterDeck?.()
      api.info?.('🐀 屋主的住处：找出「鼠群」并生成在「发霉的走道」。')
    },
  },
}
