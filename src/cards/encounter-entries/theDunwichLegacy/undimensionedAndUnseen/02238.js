// 02238 等待时机
// 归属：关卡专用 · undimensionedAndUnseen（无人知晓）
// 遭遇组：undimensioned_and_unseen
// 卡面：强制 - 当敌军阶段结束时：将每个犹格·索托斯之子敌人朝一个随机地点移动一次。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { activeInvestigators } from '../../_shared.js'

export default {
  code: '02238', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      const zones = state.scenarioZones
      api.shuffleDiscard()
      if (!zones.brood.remaining) return
      zones.brood.remaining--
      zones.setAside.splice(zones.setAside.indexOf('02255'), 1)
      const location = state.investigators[state.campaign.leadSeat].location
      const enemy = api.spawn('02255', location)
      if (!enemy) return
      enemy.health = 1 + state.numInvestigators
      for (const inv of activeInvestigators(state).filter(item => item.location === location)) {
        api.test(inv.seat, 'agility', 4, result => { if (!result.success) api.attack(enemy, inv) })
      }
    },
  },
}
