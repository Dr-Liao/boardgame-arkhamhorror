import { attackableEnemies } from './_shared.js'
export default {
  code: '07153', playCondition: [({ state, inv }) => attackableEnemies(state, inv).length > 0],
  abilities: [{ kind: 'played', countsAs: 'fight', noOpportunityAttack: true, label: '封印最多 3 个祝福：攻击',
    resolve: ({ state, inv, source, api }) => {
      const enemy = api.chooseEnemy(inv.seat, { type: 'fight' })
      if (!enemy) return
      const host = source?.id || '07153'
      const max = Math.min(3, state.chaosBag.filter(token => token === 'bless').length)
      const count = max ? Number(api.choice({ kind: 'token', seat: inv.seat, source: '07153', prompt: '选择封印的祝福数量。',
        options: Array.from({ length: max + 1 }, (_, n) => ({ id: String(n), label: `${n} 个祝福` })) })) : 0
      api.chaosTokens.seal(host, 'bless', count)
      const skill = api.choice({ kind: 'skill', seat: inv.seat, source: '07153', prompt: '选择本次攻击使用的技能。',
        options: [{ id: 'combat', label: '战斗' }, { id: 'willpower', label: '意志' }] })
      api.fight(inv.seat, enemy.id, { skill, combatBonus: count, damageBonus: count, sourceCode: '07153' })
      api.chaosTokens.release(host, 'bless', count, { toPool: !state.enemies.some(other => other.id === enemy.id) })
    } }],
}
