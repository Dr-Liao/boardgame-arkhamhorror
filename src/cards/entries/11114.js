import { attackableEnemies } from './_shared.js'

const code = '11114'

export default {
  code,
  playCondition: [{
    when: ({ state, inv }) => attackableEnemies(state, inv).length > 0,
    message: '本地点没有可攻击的敌人',
  }],
  abilities: [{
    kind: 'played', countsAs: 'fight',
    label: '攻击（战斗或意志）：每个空手部槽位使技能值 +2、伤害 +1；击败非精英则将它和附属事件放入胜利区',
    resolve: ({ inv, state, context, api }) => {
      const targets = attackableEnemies(state, inv)
      if (!targets.length) return
      const enemyId = targets.length === 1 ? targets[0].id : api.choice({
        kind: 'enemy', source: code, seat: inv.seat, prompt: '选择攻击目标。',
        options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const skill = api.choice({
        kind: 'skill', source: code, seat: inv.seat, prompt: '选择用于攻击的技能。',
        options: [{ id: 'combat', label: '战斗' }, { id: 'willpower', label: '意志' }],
      })
      const slots = api.emptyAssetSlots(inv.seat, 'hand')
      const result = api.fight(inv.seat, enemyId, {
        noSpend: true, sourceCode: code, skill, combatBonus: 2 * slots, damageBonus: slots,
        victoryAttachment: context.cardId,
      })
      if (result?.attackResult?.victoryAttached) context.victoryAttached = true
    },
  }],
}
