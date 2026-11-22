// 60329 背刺
// 卡面：攻击。本次攻击不使用[combat]，改为使用[agility]。本次攻击造成+2伤害。如果你成功超过难度至少2点，你的回合结束时将背刺返回手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { attackableEnemies } from './_shared.js'

export default {
  code: '60329',
  playCondition: [{ when: ({ state, inv }) => attackableEnemies(state, inv).length > 0, message: '没有可攻击的同地点敌人' }],
  abilities: [{
    kind: 'played', countsAs: 'fight',
    label: '用敏捷攻击，伤害 +2；成功超过难度至少 2 点回合结束收回',
    resolve: ({ inv, api, context }) => {
      const enemy = api.chooseEnemy(inv.seat, { type: 'fight' })
      if (!enemy) return
      api.fight(inv.seat, enemy.id, {
        skill: 'agility', damageBonus: 2,
        onSuccess: ({ result }) => {
          if (result.value - result.difficulty >= 2) api.returnPlayedEventAtEndOfTurn(context)
        },
      })
    },
  }],
}
