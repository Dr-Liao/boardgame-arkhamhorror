// 03087 拜亚基的猎杀
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：byakhee
// 卡面：显现 - 检定[agility](6)。如果你检定失败，揭示遭遇牌库顶的X张卡牌，其中X为你失败且低于难度的数量。如果因本效果揭示了至少1张[[拜亚基]]敌人，选择其中1张并将其抽取。如果因本效果揭示了至少1张[[征兆]]诡计，受到1点恐惧。混洗遭遇牌库。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { ALL_CARDS, failedBy } from '../../../_shared.js'

export default {
  code: '03087', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'agility', 6, result => {
      if (result.success) return
      const count = failedBy(result, 6)
      const revealed = state.encounterDeck.splice(Math.max(0, state.encounterDeck.length - count))
      const cardOf = candidate => ALL_CARDS[typeof candidate === 'string'
        ? candidate : candidate?.originalCode || candidate?.code]
      api.info?.(`拜亚基的猎杀：揭示遭遇牌库顶 ${revealed.length} 张——${revealed.map(code =>
        cardOf(code)?.nameZh || code).join('、') || '（空）'}。`)
      const byakhees = revealed.filter(candidate => cardOf(candidate)?.traits?.includes('Byakhee'))
      const omens = revealed.filter(candidate => cardOf(candidate)?.traits?.includes('Omen'))
      if (omens.length) {
        api.info?.(`征兆诡计「${omens.map(code => cardOf(code)?.nameZh || code).join('、')}」出现，${inv.name} 受到 1 点恐惧。`)
        api.horror(inv.seat, 1)
      }
      let chosen = null
      if (byakhees.length === 1) chosen = byakhees[0]
      else if (byakhees.length > 1) {
        const answer = api.choose({
          kind: 'card', source: '03087', seat: inv.seat,
          prompt: '选择一张被揭示的[[拜亚基]]敌人并抽取它。',
          options: byakhees.map((code, index) => ({
            id: String(index), cardCode: code,
            label: cardOf(code)?.nameZh || code,
          })),
        })
        chosen = byakhees[Number(answer)] || byakhees[0]
      }
      const rest = revealed.filter(candidate => candidate !== chosen)
      state.encounterDeck.push(...rest)
      api.shuffleEncounterDeck()
      if (chosen) {
        // 「抽取」= 作为遭遇卡结算（生成并交战），不是洗回牌库。
        state.encounterDeck.push(chosen)
        api.info?.(`拜亚基的猎杀：${inv.name} 抽取「${cardOf(chosen)?.nameZh || chosen}」。`)
        api.drawEncounter(inv.seat)
      }
    })
    // 结算完成后本卡进入遭遇弃牌堆；返回 true 会被引擎当成「已放置」而永久离场。
    return false
  },
}
