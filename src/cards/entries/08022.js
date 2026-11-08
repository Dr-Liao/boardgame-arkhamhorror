// 08022 成群结队
// 卡面：攻击。你每控制一张不同职阶的卡牌，你本次攻击得到 +1[combat]，造成 +1 伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：「你每控制一张不同职阶的卡牌」= 你控制的卡牌中不同职阶（faction）的数量（中立不计入
// 「职阶」）；用 api.cardFactions 读取每张在场卡牌的职阶，攻击走 api.fight 的临时 combatBonus/
// damageBonus（不产生持续状态）。
import { attackableEnemies } from './_shared.js'

export default {
  code: '08022',
  abilities: [
    {
      kind: 'played',
      countsAs: 'fight',
      noOpportunityAttack: true,
      label: '攻击：每控制一张不同职阶的卡牌，+1[combat] 且 +1 伤害',
      resolve: ({ state, inv, api }) => {
        const targets = attackableEnemies(state, inv)
        if (!targets.length) {
          api.info('没有可攻击的敌人。')
          return
        }
        const chosen = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: '08022', seat: inv.seat,
          prompt: '成群结队：选择攻击目标。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        const classes = new Set((inv.assets || [])
          .flatMap(card => api.cardFactions(card.code))
          .filter(faction => faction && faction !== 'neutral'))
        const bonus = Math.min(5, classes.size)
        api.fight(inv.seat, enemy.id, {
          combatBonus: bonus, damageBonus: bonus, noSpend: true, sourceCode: '08022',
          presentationCardCode: '08022',
        })
      },
    },
  ],
  modifiers: [],
}
