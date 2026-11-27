import { attackableEnemies } from './_shared.js'

const code = '11115'
const symbolFaces = new Set(['skull', 'cultist', 'tablet', 'elderthing'])

export default {
  code,
  abilities: [{
    kind: 'action',
    countsAs: 'fight',
    cost: { action: true },
    label: '攻击：加入意志值；成功后可横置，按揭示符号对本地点一个敌人造成至多 3 伤害',
    target: { kind: 'enemy', query: ({ state, inv, entity }) => attackableEnemies(state, inv).includes(entity) },
    resolve: ({ inv, source, target, state, api }) => {
      const result = api.fight(inv.seat, target.id, {
        addSkill: 'willpower', noSpend: true, assetId: source.id, trackAssetSource: true,
      })
      if (!result?.success || source.exhausted || !inv.assets.includes(source)) return
      const amount = Math.min(3, result.drawn.filter(token => symbolFaces.has(token)).length)
      if (!amount) return
      const sourceOfHarm = { code, assetId: source.id }
      // A single chosen enemy takes the cumulative damage for the matching symbols.
      const enemies = state.enemies.filter(enemy => !enemy.defeated && enemy.location === inv.location
        && api.canDamageEnemy(enemy, inv.seat, sourceOfHarm))
      if (!enemies.length) return
      const selected = api.choice({
        kind: 'enemy', source: code, seat: inv.seat, canSkip: true,
        prompt: `是否横置风暴御主，对本地点一名敌人造成 ${amount} 点伤害？`,
        options: [{ id: 'skip', label: '不横置' }, ...enemies.map(enemy => ({ id: enemy.id, label: enemy.name }))],
      })
      if (selected === 'skip') return
      api.exhaust(source)
      api.damageEnemy(enemies.find(enemy => enemy.id === selected), amount, inv.seat, sourceOfHarm)
    },
  }],
}
