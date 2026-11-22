// 60367 突然坠落（A Sudden Fall，André Patel）
// 卡面：攻击（[combat]）。本次攻击你得到 +2[combat]。
//       如果目标敌人处于横置状态，本次攻击造成 +1 伤害。
import { attackableEnemies } from './_shared.js'

export default {
  code: '60367',
  abilities: [{
    kind: 'played',
    label: '攻击 +2 战斗；目标横置时 +1 伤害',
    resolve: ({ state, inv, api }) => {
      const targets = attackableEnemies(state, inv)
      if (!targets.length) {
        api.info('没有可攻击的敌人。')
        return
      }
      const chosen = targets.length === 1 ? targets[0].id : api.choice({
        kind: 'target', source: '60367', seat: inv.seat,
        prompt: '选择攻击目标。',
        options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = targets.find(item => item.id === chosen) || targets[0]
      api.fight(inv.seat, enemy.id, {
        combatBonus: 2, damageBonus: enemy.exhausted ? 1 : 0, noSpend: true, sourceCode: '60367',
      })
    },
  }],
}
