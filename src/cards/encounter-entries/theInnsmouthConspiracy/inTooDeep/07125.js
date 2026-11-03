// 07125 无情浪潮（Relentless Tide）· 议程 2 · 深陷其中 第三章
//
// 印刷（中文）：
//   每个[[嫌犯]]敌人失去冷漠，并且不能与之谈判。
//   强制 - 在你回合结束时，如果你位于完全淹没的地点：受到1点伤害和1点恐惧。
//   背面（推进时）：提升每个[[城中]]地点的淹没等级。
//     将放在一边的愤怒暴民生成在印斯茅斯广场。
//     从放在一边正面朝下的钥匙中随机选择1个，放到愤怒暴民上，不要查看。
//
// 引擎读点：
//   · 正面同 07124 的工厂（enemyLosesAloof / parleyBlocked / turnEnded 强制）。
//   · 背面：api.mechanics.water.change；api.takeFromSetAside + api.spawn；
//     api.mechanics.keys.placeRandom(`enemy:<id>`)（scenario-keys.js 的随机未揭示钥匙）。

import {
  floodedStreetAgendaRule, floodedStreetTurnEndAbility, hasTrait, originalOf,
} from '../../_shared.js'

const ANGRY_MOB = '07062b'
const INNSMOUTH_SQUARE = '07139'

export default {
  code: '07125', scope: 'agenda', implemented: true,
  abilities: [floodedStreetTurnEndAbility({ damage: 1, horror: 1 })],
  agendaRule: floodedStreetAgendaRule({
    onReveal(state, agenda, api) {
      for (const location of state.locations.filter(item => hasTrait(item, 'Midtown'))) {
        api.mechanics.water.change(location.id, 1)
      }
      const square = state.locations.find(item => String(originalOf(item)) === INNSMOUTH_SQUARE)
      if (square && api.takeFromSetAside(ANGRY_MOB)) {
        const mob = api.spawn(ANGRY_MOB, square.id)
        if (mob) api.mechanics.keys.placeRandom(`enemy:${mob.id}`)
      }
      api.info(`「${originalOf(agenda)}」背面：城中涨水；愤怒暴民在印斯茅斯广场生成并带着一把暗置钥匙。`)
    },
  }),
}
