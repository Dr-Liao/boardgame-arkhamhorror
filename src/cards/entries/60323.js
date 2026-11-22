// 60323 暗中偷袭
// 卡面：攻击。本次攻击中，将你的[agility]加到你的技能值上。如果你成功超过难度至少1点，自动躲避受到本次攻击的敌人。如果你成功超过难度至少3点，你的回合结束时将暗中偷袭返回手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { attackableEnemies } from './_shared.js'

export default {
  code: '60323',
  playCondition: [{ when: ({ state, inv }) => attackableEnemies(state, inv).length > 0, message: '没有可攻击的同地点敌人' }],
  abilities: [{
    kind: 'played', countsAs: 'fight',
    label: '攻击时加上敏捷，超过难度 1 点则自动躲避；超过 3 点则回合结束收回',
    resolve: ({ inv, api, context }) => {
      const enemy = api.chooseEnemy(inv.seat, { type: 'fight' })
      if (!enemy) return
      api.fight(inv.seat, enemy.id, {
        addSkill: 'agility', autoEvadeOnSuccessBy: 1,
        onSuccess: ({ result }) => {
          if (result.value - result.difficulty >= 3) api.returnPlayedEventAtEndOfTurn(context)
        },
      })
    },
  }],
}
