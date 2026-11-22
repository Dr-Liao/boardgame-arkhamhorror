// 60363 抛光手杖（Polished Cane，André Patel）
// 卡面：[action]：攻击（[combat]）。本次攻击将你的[agility]加入你的[combat]。
//       如果本次攻击对一个非[[精英]]敌人成功且超过难度至少 2 点，你可以横置抛光手杖以自动躲避该敌人。
import { attackableEnemies } from './_shared.js'

export default {
  code: '60363',
  abilities: [{
    kind: 'action',
    countsAs: 'fight',
    label: '攻击：加入敏捷；成功超过 2 点对非精英可横置自动躲避',
    cost: { action: true },
    resolve: ({ state, inv, source, api }) => {
      const targets = attackableEnemies(state, inv)
      if (!targets.length) {
        api.info('没有可攻击的敌人。')
        return
      }
      const chosen = targets.length === 1 ? targets[0].id : api.choice({
        kind: 'target', source: '60363', seat: inv.seat,
        prompt: '选择攻击目标。',
        options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = targets.find(item => item.id === chosen) || targets[0]
      api.fight(inv.seat, enemy.id, {
        assetId: source.id, addSkill: 'agility', noSpend: true, sourceCode: '60363',
        onSuccess: result => {
          if (!enemy || enemy.elite) return
          if ((result?.successBy ?? 0) < 2) return
          if (!state.enemies.some(item => item.id === enemy.id)) return
          const answer = api.choice({
            kind: 'effect', source: '60363', seat: inv.seat, canSkip: true,
            prompt: '攻击成功超过 2 点：是否横置抛光手杖以自动躲避该敌人？',
            options: [{ id: 'skip', label: '不横置' }, { id: 'exhaust', label: '横置并自动躲避' }],
          })
          if (answer !== 'exhaust') return
          api.exhaust(source)
          api.autoEvadeEnemy(enemy)
        },
      })
    },
  }],
}
