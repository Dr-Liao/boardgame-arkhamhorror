// 60378 突然坠落（升级版，André Patel，2 XP）
// 卡面：攻击（[agility]）。本次攻击将你的[combat]加入你的[agility]。
//       如果目标敌人处于横置状态，本次攻击造成 +2 伤害。
import { attackableEnemies } from './_shared.js'

export default {
  code: '60378',
  abilities: [{
    kind: 'played',
    label: '攻击（敏捷 + 战斗）；目标横置时 +2 伤害',
    resolve: ({ state, inv, api }) => {
      const targets = attackableEnemies(state, inv)
      if (!targets.length) {
        api.info('没有可攻击的敌人。')
        return
      }
      const chosen = targets.length === 1 ? targets[0].id : api.choice({
        kind: 'target', source: '60378', seat: inv.seat,
        prompt: '选择攻击目标。',
        options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = targets.find(item => item.id === chosen) || targets[0]
      api.fight(inv.seat, enemy.id, {
        skill: 'agility', addSkill: 'combat', damageBonus: enemy.exhausted ? 2 : 0,
        noSpend: true, sourceCode: '60378',
      })
    },
  }],
}
