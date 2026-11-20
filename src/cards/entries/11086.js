import { ALL_CARDS } from '../cards-data.js'
import { enemyInEngagement } from '../../engine/enemy-parts.js'

const code = '11086'
const evasionTargets = (state, inv) => state.enemies.filter(enemy => !enemy.defeated
  && !enemy.hasParts && enemy.location === inv.location && enemyInEngagement(state, enemy, inv))

export default {
  code,
  discardPlayCost: { trait: 'Item', slot: 'hand', zones: ['hand', 'play'] },
  playCondition: [{
    when: ({ state, inv }) => evasionTargets(state, inv).length > 0,
    message: '没有可躲避的交战敌人',
  }],
  abilities: [{
    kind: 'played',
    countsAs: 'evade',
    label: '弃掉占手部槽位的道具：躲避，按弃牌的印刷费用增加敏捷；从场上弃掉时，成功则非精英敌人下次补给不重整',
    resolve: ({ inv, state, context, api }) => {
      const paid = context.playCost?.discardedCard
      const targets = evasionTargets(state, inv)
      if (!paid || !targets.length) return
      const enemyId = targets.length === 1 ? targets[0].id : api.choice({
        kind: 'enemy', source: code, seat: inv.seat, prompt: '选择要躲避的敌人。',
        options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      api.evade(inv.seat, {
        enemyId, sourceCode: code, bonus: ALL_CARDS[paid.code]?.cost || 0,
        skipReadyRounds: paid.from === 'play' ? 1 : 0, skipReadyRoundsNonElite: true,
      })
    },
  }],
}
