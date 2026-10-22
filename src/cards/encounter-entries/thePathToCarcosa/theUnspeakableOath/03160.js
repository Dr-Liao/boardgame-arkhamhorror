// 03160 锁闭
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { stashRandomMonsterInEntry } from '../../_shared.js'

export default {
  code: '03160', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      state.encounterDeck.push(...state.scenarioZones.lunatics.splice(0))
      api.shuffleDiscard()
      stashRandomMonsterInEntry(state, api)
    },
  },
}
