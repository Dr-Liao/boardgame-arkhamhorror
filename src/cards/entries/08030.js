// 08030 蝴蝶对剑（等级 5）
// 卡面：[action]：攻击。本次攻击你得到 +2[combat]。本次攻击后，你可以再次攻击，
//       这次攻击将你的[agility]加入你的技能值。如果两次攻击都成功，你可以横置蝴蝶对剑，
//       使第二次攻击造成 +1 伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：第一次攻击 combatBonus 2；随后可再次攻击（addSkill:'agility'，+1 伤害）。
// 「两次都成功才可以横置使第二次 +1 伤害」：用两次攻击的 onSuccess 记录成功，再在结算后补 1 点伤害
// 并横置（approximation：这是 post-hoc 追加伤害，不是把 +1 并入第二次攻击的伤害结算；若第二次攻击
// 已击败敌人则不再补）。第二次攻击本身不额外花行动（noSpend）。
import { attackableEnemies } from './_shared.js'

export default {
  code: '08030',
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      label: '攻击（+2[combat]）；可再次攻击（加入[agility]）；两次都成功可横置使第二次 +1 伤害',
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
        let firstSuccess = false
        let secondSuccess = false
        api.fight(inv.seat, enemy.id, {
          assetId: source.id, combatBonus: 2, noSpend: true, sourceCode: '08030',
          onSuccess: () => { firstSuccess = true },
        })
        if (!state.enemies.includes(enemy)) return
        const again = api.choice({
          kind: 'effect', source: source.id, seat: inv.seat, canSkip: true,
          prompt: '本次攻击后：是否再次攻击（加入[agility]）？',
          options: [{ id: 'skip', label: '不再攻击' }, { id: 'again', label: '再次攻击（加入[agility]）' }],
        })
        if (again !== 'again') return
        api.fight(inv.seat, enemy.id, {
          assetId: source.id, addSkill: 'agility', noSpend: true, sourceCode: '08030',
          onSuccess: () => { secondSuccess = true },
        })
        if (firstSuccess && secondSuccess && state.enemies.some(item => item.id === enemy.id)) {
          const exhaust = api.choice({
            kind: 'effect', source: source.id, seat: inv.seat, canSkip: true,
            prompt: '两次攻击都成功：是否横置蝴蝶对剑，使第二次攻击 +1 伤害？',
            options: [{ id: 'skip', label: '不横置' }, { id: 'exhaust', label: '横置：第二次攻击 +1 伤害' }],
          })
          if (exhaust === 'exhaust') {
            api.exhaust(source)
            // 事务克隆/嵌套检定后敌人对象会换新：从 api 读点按 id 重取再结算这次追加伤害。
            const current = (api.enemiesAt(inv.location) || []).find(item => item.id === enemy.id)
            if (current) api.damageEnemy(current, 1, inv.seat)
          }
        }
      },
    },
  ],
  modifiers: [],
}
