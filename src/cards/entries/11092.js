import { attackableEnemies } from './_shared.js'

const code = '11092'

export default {
  code,
  playableFromDiscard: true,
  shuffleBackAfterPlay: true,
  drawAfterShuffleBack: 1,
  playCondition: [{
    when: ({ state, inv }) => attackableEnemies(state, inv).length > 0,
    message: '所在地点没有可攻击的敌人',
  }],
  abilities: [{
    kind: 'played', countsAs: 'fight',
    label: '攻击：敌人战斗 −2。从弃牌堆打出时，伤害 +1，结算后洗回牌库并抽 1 张牌',
    resolve: ({ inv, state, api }) => {
      const targets = attackableEnemies(state, inv)
      const enemyId = targets.length === 1 ? targets[0].id : api.choice({
        kind: 'enemy', source: code, seat: inv.seat, prompt: '选择攻击目标。',
        options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const fromDiscard = api.fromDiscardCode() === code
      api.fight(inv.seat, enemyId, { noSpend: true, enemyFightMod: -2, damageBonus: fromDiscard ? 1 : 0 })
    },
  }],
}
