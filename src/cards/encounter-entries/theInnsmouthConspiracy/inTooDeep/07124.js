// 07124 路障重重（Barricaded Streets）· 议程 1 · 深陷其中 第三章
//
// 印刷（中文）：
//   每个[[嫌犯]]敌人失去冷漠，并且不能与之谈判。
//   强制 - 在你回合结束时，如果你位于完全淹没的地点：受到1点伤害。
//   背面（推进时）：提升每个[[海岸]]地点的淹没等级。
//     将每张放在一边的深海劫掠者、年幼的深潜者敌人，和遭遇弃牌堆一起混洗入遭遇牌库。
//
// 引擎读点：
//   · 正面两句用 floodedStreetAgendaRule 工厂：enemyLosesAloof / parleyBlocked 由内容层
//     entry-rules.js 数据驱动分派到 hidden-rules / moves 的既有读点。
//   · 回合末强制走既有 turnEnded 窗口（forced 实体能力），floodLevel === 2 才触发。
//   · 背面改水位用 api.mechanics.water.change（flood.js，封顶/地点规则内建）；
//     从 setAside 取回 07145/01181 后 api.shuffleIntoEncounterDeck + api.shuffleDiscard。

import {
  floodedStreetAgendaRule, floodedStreetTurnEndAbility, hasTrait, originalOf,
} from '../../_shared.js'

const COASTAL_FLOOD_ENEMIES = ['07145', '01181']

export default {
  code: '07124', scope: 'agenda', implemented: true,
  abilities: [floodedStreetTurnEndAbility({ damage: 1 })],
  agendaRule: floodedStreetAgendaRule({
    onReveal(state, agenda, api) {
      for (const location of state.locations.filter(item => hasTrait(item, 'Coastal'))) {
        api.mechanics.water.change(location.id, 1)
      }
      const added = []
      for (const code of COASTAL_FLOOD_ENEMIES) while (api.takeFromSetAside(code)) added.push(code)
      if (added.length) api.shuffleIntoEncounterDeck(added)
      api.shuffleDiscard()
      api.info(`「${originalOf(agenda)}」背面：海岸涨水；${added.length} 张深海敌人与遭遇弃牌堆洗回牌库。`)
    },
  }),
}
