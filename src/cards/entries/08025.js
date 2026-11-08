// 08025 蝴蝶对剑（等级 2）
// 卡面：[action]：攻击。本次攻击你得到 +1[combat]。本次攻击后，你可以横置蝴蝶对剑再次
//       进行攻击，这次攻击将你的[agility]加入你的技能值。这次攻击造成 +1 伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：第一次攻击用 api.fight（战斗 +1，skillBonus 走 combatBonus）；结算后询问是否横置
// 进行第二次攻击（noSpend 不再花行动），第二次把敏捷加入技能值并 +1 伤害。敌人若在第一次
// 攻击中被击败则跳过第二次。
import { attackableEnemies } from './_shared.js'

export default {
  code: '08025',
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      label: '攻击（+1[combat]）；可横置再次攻击（加入[agility]，+1 伤害）',
      cost: { action: true },
      resolve: ({ state, inv, source, api }) => {
        const targets = attackableEnemies(state, inv)
        if (!targets.length) {
          api.info('没有可攻击的敌人。')
          return
        }
        const chosen = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: source.id, seat: inv.seat,
          prompt: '蝴蝶对剑：选择攻击目标。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        api.fight(inv.seat, enemy.id, { assetId: source.id, combatBonus: 1, noSpend: true, sourceCode: '08025' })
        if (!state.enemies.includes(enemy)) return
        const again = api.choice({
          kind: 'effect', source: source.id, seat: inv.seat, canSkip: true,
          prompt: '本次攻击后：是否横置蝴蝶对剑再次攻击？',
          options: [{ id: 'skip', label: '不再次攻击' }, { id: 'again', label: '横置并再次攻击（加入[agility]，+1 伤害）' }],
        })
        if (again !== 'again') return
        api.exhaust(source)
        api.fight(inv.seat, enemy.id, {
          assetId: source.id, addSkill: 'agility', damageBonus: 1, noSpend: true, sourceCode: '08025',
        })
      },
    },
  ],
  modifiers: [],
}
