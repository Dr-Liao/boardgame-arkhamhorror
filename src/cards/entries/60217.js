// 60217 秘术祈求
// 卡面：作为打出秘术祈求的额外费用，弃掉你手牌中至多2张卡牌。
// 卡面：攻击。本次攻击不使用[combat]，改为使用[intellect]。你为支付本卡牌费用每弃掉1张手牌，本次攻击便得到+1[intellect]并造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { attackableEnemies } from './_shared.js'

export default {
  code: '60217',
  discardPlayCost: { zones: ['hand'], upTo: 2 },
  playCondition: [{ when: ({ state, inv }) => attackableEnemies(state, inv).length > 0, message: '没有可攻击的同地点敌人' }],
  abilities: [{
    kind: 'played', countsAs: 'fight',
    label: '用智识攻击；每张作为额外费用弃掉的手牌使智识和伤害各 +1',
    resolve: ({ inv, api, context }) => {
      const enemy = api.chooseEnemy(inv.seat, { type: 'fight' })
      if (!enemy) return
      const paid = context.playCost?.discardedCards?.length || 0
      api.fight(inv.seat, enemy.id, { skill: 'intellect', combatBonus: paid, damageBonus: paid })
    },
  }],
}
