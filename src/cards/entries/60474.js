// 60474 阿撒托斯的惊骇诅咒（Dread Curse of Azathoth，Marie Lambeau，3 XP）
// 卡面：卓越。
//       [action] 在阿撒托斯的惊骇诅咒上放置 1 个毁灭标记：攻击（[willpower]）。本次攻击你得到 +2[willpower] 并造成 +1 伤害。
//       如果本次攻击击败了一个敌人，从本卡上移除 1 个毁灭标记。
//       如果本次检定期间揭示了[skull]或[elder_thing]标记，移除本卡上所有毁灭标记。
import { attackableEnemies } from './_shared.js'

const CURSED_TOKENS = ['skull', 'elderthing']

export default {
  code: '60474',
  abilities: [{
    kind: 'action',
    countsAs: 'fight',
    label: '放置 1 毁灭：攻击（意志 +2，伤害 +1）',
    cost: { action: true },
    resolve: ({ state, inv, source, api }) => {
      api.placeDoomOnCard(source, 1)
      const targets = attackableEnemies(state, inv)
      if (!targets.length) {
        api.info('没有可攻击的敌人。')
        return
      }
      const chosen = targets.length === 1 ? targets[0].id : api.choice({
        kind: 'target', source: '60474', seat: inv.seat,
        prompt: '选择攻击目标。',
        options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = targets.find(item => item.id === chosen) || targets[0]
      api.fight(inv.seat, enemy.id, {
        assetId: source.id, skill: 'willpower', combatBonus: 2, damageBonus: 1,
        noSpend: true, sourceCode: '60474',
        onSuccess: result => {
          const tokens = result?.drawn || []
          if (tokens.some(token => CURSED_TOKENS.includes(token))) {
            api.removeDoomFromCard(source, Number(source.doom || 0))
            return
          }
          if (!state.enemies.some(item => item.id === enemy.id)) api.removeDoomFromCard(source, 1)
        },
      })
    },
  }],
}
