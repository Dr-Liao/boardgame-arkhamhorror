// 08673 坍塌高塔（Collapse the Pylons）· 幕 3
// 卡面：每座已揭示的迷雾高塔可被当作敌人攻击（fight=帷幕、health=线索值）；生命为 0 即坍塌。
// [reaction] 在迷雾高塔发现 1+ 线索时，花费那些线索：对高塔造成等量伤害。
// 目标 - 回合结束时，如果每座迷雾高塔都已坍塌，推进。背面：rampSequence。
import { collapsedTowers, towerDamagePrevented, towerState } from '../../_shared.js'
export default {
  code: '08673',
  scope: 'act',
  implemented: true,
  actRule: {
    objective: { type: 'collapsePylons' },
    backEffect: 'rampSequence',
    pylonAttackable: true,
  },
  abilities: [{
    kind: 'forced', trigger: 'roundEnds',
    label: '轮末：如果每座迷雾高塔都已坍塌，推进幕',
    criteria: ({ state }) => collapsedTowers(state).length >= 5,
    resolve: ({ api }) => api.scenario.advanceAct(),
  }, {
    kind: 'reaction', trigger: 'clueDiscovered',
    label: '花费刚在迷雾高塔发现的线索：对该高塔造成等量伤害',
    criteria: ({ state, inv, context }) => context.seat === inv.seat && context.amount > 0
      && inv.clues >= context.amount
      && state.locations.some(location => location.id === context.location && location.mistPylon)
      && towerState(state, context.location)?.collapsed === false
      && !towerDamagePrevented(state, context.location),
    resolve: ({ state, inv, context, api }) => {
      api.spendClues(inv.seat, context.amount)
      const sealA = api.mechanics.eoteCampaign.seals.state('A')
      const bonus = state.scenarioFlags?.pylonPowers?.A && sealA?.placedBySeat === inv.seat ? 1 : 0
      api.mechanics.facilities.damageTower({ towerId: context.location, amount: context.amount + bonus, source: '08673' })
    },
  }],
}
