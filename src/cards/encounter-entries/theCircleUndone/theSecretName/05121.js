// 05121 隐士·IX（The Hermit · IX）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：每个非弱点敌人 +1 生命；反应 - 击败布朗·詹金/那赫卜得线索。背面 - 找鼠群/布朗·詹金。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
//
// 背面按参考实现 TheHermitIX.hs：findEncounterCard 只查「遭遇牌库 + 遭遇弃牌堆」，
// 找到才生成；布朗·詹金在遭遇牌库（setup 不再把他放 set aside）。
// 反应（击败詹金/那赫卜得线索）由 behavior.enemyDefeated 的议程反应统一结算，不在本文件。
import { ALL_CARDS, originalOf } from '../../_shared.js'

const findInEncounter = (api, predicate) => {
  // 甲：遭遇弃牌堆（从顶向下）→ 乙：遭遇牌库（牌库顶 = 数组尾）。读写收口到 api。
  const discard = api.encounterDiscardCards?.() || []
  for (let index = discard.length - 1; index >= 0; index--) {
    if (!predicate(discard[index])) continue
    api.takeEncounterDiscard?.(discard[index])
    return discard[index]
  }
  // 遭遇牌库顶 = 数组尾：从顶向下检索。
  const deck = api.encounterDeckCards?.() || []
  for (let index = deck.length - 1; index >= 0; index--) {
    if (!predicate(deck[index])) continue
    api.takeEncounterDeckCard?.(deck[index])
    return deck[index]
  }
  return null
}

const isRats = code => String(code) === '01159'
const isJenkin = code => String(code) === '05148'
const traitsOf = card => (ALL_CARDS[originalOf(card)]?.traits || card?.traits || []).map(trait => String(trait).toLowerCase())
const hasTrait = (card, trait) => traitsOf(card).includes(String(trait).toLowerCase())
const leadSeat = state => state.campaign?.leadSeat ?? 0

export default {
  code: '05121', scope: 'agenda', implemented: true,
  agendaRule: {
    onReveal(state, agenda, api) {
      const jenkin = state.enemies.find(enemy => String(originalOf(enemy)) === '05148')
      if (jenkin) {
        // 布朗·詹金在场：找一张鼠群生成在他所在地点（找不到就没有效果）。
        const rats = findInEncounter(api, isRats)
        if (rats) api.spawn?.(rats, jenkin.location)
      } else {
        // 布朗·詹金不在场：找出他，生成在队长所在地点（找不到就没有效果）。
        const found = findInEncounter(api, isJenkin)
        const lead = state.investigators[leadSeat(state)]
        if (found && lead?.location) api.spawn?.(found, lead.location)
      }
      // 3–4 人：再找一张鼠群，生成在任意一个巫宅地点（卡面 any → 主持选择）。
      if (state.numInvestigators >= 3) {
        const rats = findInEncounter(api, isRats)
        if (rats) {
          const witchHouses = state.locations.filter(location => hasTrait(location, 'witch house'))
          if (witchHouses.length) {
            let target = witchHouses[0]
            if (witchHouses.length > 1) {
              const picked = api.choose?.({
                kind: 'location', source: '05121', seat: leadSeat(state),
                prompt: '隐士·IX：选择鼠群生成的[[巫宅]]地点。',
                options: witchHouses.map(location => ({ id: location.id, label: location.name })),
              })
              target = witchHouses.find(location => location.id === picked) || witchHouses[0]
            }
            api.spawn?.(rats, target.id)
          }
        }
      }
      return true
    },
  },
}
