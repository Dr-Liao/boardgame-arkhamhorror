// 08023 扫堂腿
// 卡面：攻击。本次攻击将你的[agility]加入你的技能值。本次攻击造成 +1 伤害。
//       如果你成功，自动躲避受到本次攻击的敌人。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：doFight 的 addSkill:'agility' 把敏捷值加到本次攻击技能值；autoEvadeOnSuccessBy:0
// 表示「成功即自动躲避」；伤害 +1 走 damageBonus。
import { attackableEnemies } from './_shared.js'

export default {
  code: '08023',
  abilities: [
    {
      kind: 'played',
      countsAs: 'fight',
      noOpportunityAttack: true,
      label: '攻击：加入[agility]，+1 伤害，成功则自动躲避该敌人',
      resolve: ({ state, inv, api }) => {
        const targets = attackableEnemies(state, inv)
        if (!targets.length) {
          api.info('没有可攻击的敌人。')
          return
        }
        const chosen = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: '08023', seat: inv.seat,
          prompt: '扫堂腿：选择攻击目标。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        api.fight(inv.seat, enemy.id, {
          addSkill: 'agility', damageBonus: 1, autoEvadeOnSuccessBy: 0, noSpend: true,
          sourceCode: '08023', presentationCardCode: '08023',
        })
      },
    },
  ],
  modifiers: [],
}
