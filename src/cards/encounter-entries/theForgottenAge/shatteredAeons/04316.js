// 04316 垂下的丝线
// 归属：关卡专用 · shatteredAeons（失落的时代 · 破碎永世）
// 遭遇组：shattered_aeons
// 卡面：强制 - 如果一位手牌、牌库、弃牌堆或游戏区域内有古代遗物的调查员退场：立即推进到密谋3b。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 密谋 04316「垂摆之线」背面：无形之子在场则在其上放 2 毁灭；在胜利区则洗回遭遇牌库。

import { originalOf } from '../../_shared.js'

export default {
  code: '04316', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api, hooks) {
      api.shuffleDiscard()
      const nexus = hooks.byId(hooks.nexus())
      const formless = state.enemies.find(enemy => originalOf(enemy) === hooks.formlessSpawn())
      if (formless && nexus) {
        nexus.doom = (nexus.doom || 0) + 2
        api.info?.('🌑 无形之子在场：恩凯联结点上放置 2 个毁灭标记。')
      }
      const inVictory = (state.victoryDisplay || []).find(card =>
        String(card.originalCode || card.code) === hooks.formlessSpawn())
      if (inVictory) {
        state.victoryDisplay = state.victoryDisplay.filter(card => card !== inVictory)
        state.encounterDeck = [...(state.encounterDeck || []), hooks.formlessSpawn()]
        // 卡面：洗回遭遇牌库，不能只是放在牌库顶。
        api.shuffleEncounterDeck?.()
        api.info?.('🌑 胜利区里的无形之子被洗回遭遇牌库。')
      }
      hooks.addToVictory(agenda, { vengeance: 1 })
    },
  },
}
