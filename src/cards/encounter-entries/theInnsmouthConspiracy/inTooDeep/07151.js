import { ALL_CARDS, hasTrait } from '../../_shared.js'
const used = state => state.campaign?.records?.teachingsChoices || []
const flooded = state => state.locations.filter(location => (state.scenarioFlags?.mechanics?.flood?.[location.id] || 0) > 0
  && !hasTrait(Array.isArray(location.traits) ? location : ALL_CARDS[location.originalCode || location.code], 'Sanctum'))
const targets = (state, inv, canDefeat) => state.enemies.filter(enemy => enemy.location === inv.location && !enemy.elite && canDefeat(enemy))
function options(state, inv, source, canDefeat) {
  const choices = [], done = used(state)
  if (!done.includes('Teachings1') && state.chaosBag.includes('curse')) choices.push({ id: 'Teachings1', label: '从混乱袋中移除全部诅咒' })
  if (!done.includes('Teachings2') && flooded(state).length) choices.push({ id: 'Teachings2', label: '移除一个非圣所地点的淹没标记' })
  if (!done.includes('Teachings3') && targets(state, inv, canDefeat).length) choices.push({ id: 'Teachings3', label: '击败你所在地点的一个非精英敌人' })
  return choices
}
export default {
  code: '07151', scope: 'storyAsset', implemented: true,
  abilities: [{
    kind: 'free', actionKind: 'activate', label: '横置密教教义：选择本战役尚未选过的一项效果', cost: { exhaust: true },
    criteria: [({ state, inv, source, helpers }) => options(state, inv, source,
      enemy => helpers.canDefeatEnemy(enemy, inv.seat, source)).length > 0],
    resolve: ({ state, inv, source, api }) => {
      const canDefeat = enemy => api.canDefeatEnemy(enemy, inv.seat, source)
      const available = options(state, inv, source, canDefeat)
      if (!available.length) return
      const chosen = available.length === 1 ? available[0].id : api.choice({
        kind: 'effect', source: '07151', seat: inv.seat, prompt: '密教教义：选择本战役尚未使用的教义。', options: available,
      })
      if (!available.some(option => option.id === chosen)) return
      api.recordSets.add('teachingsChoices', chosen)
      if (chosen === 'Teachings1') {
        api.chaosTokens.pay('curse', api.chaosTokens.candidates('curse').length)
      } else if (chosen === 'Teachings2') {
        const locations = flooded(state)
        const id = locations.length === 1 ? locations[0].id : api.choice({ kind: 'target', source: '07151', seat: inv.seat,
          prompt: '选择一个非圣所的已淹没地点。', options: locations.map(location => ({ id: location.id, label: location.name })) })
        if (locations.some(location => location.id === id)) api.water.set(id, 0)
      } else {
        const enemies = targets(state, inv, canDefeat)
        const id = enemies.length === 1 ? enemies[0].id : api.choice({ kind: 'target', source: '07151', seat: inv.seat,
          prompt: '选择你所在地点的一名非精英敌人。', options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = enemies.find(enemy => enemy.id === id)
        if (enemy) api.scenario.defeatEnemy(enemy, { seat: inv.seat, source })
      }
    },
  }],
}
