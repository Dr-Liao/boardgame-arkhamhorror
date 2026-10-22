// 02067 赌场骗局
// 归属：关卡专用 · theHouseAlwaysWins（敦威治遗产 · 百赌百胜）
// 遭遇组：the_house_always_wins
// 卡面：目标 - 只有在VIP区的调查员可以共同花费所需数量的线索以推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { ALL_CARDS } from '../../_shared.js'

export default {
  code: '02067', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      const university = state.campaign.scenarioResults?.some(result => result.scenarioId === 'extracurricularActivity')
      if (university) {
        api.storyAsset('02079', 'cloverClubBar')
        for (const pile of [state.encounterDeck, state.scenarioZones.clubAside || []]) {
          const index = pile.findIndex(code => ALL_CARDS[code]?.encounterCode === 'hideous_abominations'
            && ALL_CARDS[code]?.type === 'enemy')
          if (index < 0) continue
          api.spawn(pile.splice(index, 1)[0], 'cloverClubBar')
          break
        }
        state.acts.splice(2, 1)
      } else {
        api.storyAsset('02080', 'vipArea')
        state.acts.splice(3, 1)
      }
    },
  },
}
