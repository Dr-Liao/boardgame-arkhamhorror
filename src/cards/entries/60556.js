// 60556 猎犬 · 盟友（2 费，战斗图标，1/1）
// 卡面：[reaction]在敌人入场时，横置本卡：朝该敌人的地点移动一次。
// 读点：reaction trigger enemySpawn + api.moveInvestigator（沿最短路径移动一步）。
const CODE = '60556'

function stepToward(state, from, target) {
  if (!from || !target || from === target) return null
  const locations = state.locations || []
  const queue = [[from]]
  const seen = new Set([from])
  for (let index = 0; index < queue.length; index += 1) {
    const path = queue[index]
    const here = locations.find(location => location.id === path[path.length - 1])
    for (const next of here?.connections || []) {
      if (seen.has(next)) continue
      if (next === target) return path[1] || target
      seen.add(next)
      queue.push([...path, next])
    }
  }
  return null
}

export default {
  code: CODE,
  abilities: [{
    kind: 'reaction',
    trigger: 'enemySpawn',
    label: '横置猎犬：朝该敌人的地点移动一次',
    cost: { exhaust: true },
    criteria: [({ state, inv, context }) => {
      const enemyLocation = context?.enemy?.location || context?.enemyLocation
      return Boolean(enemyLocation) && Boolean(stepToward(state, inv.location, enemyLocation))
    }],
    resolve: ({ state, inv, context, api }) => {
      const enemyLocation = context?.enemy?.location || context?.enemyLocation
      const next = stepToward(state, inv.location, enemyLocation)
      if (!next) return
      api.moveInvestigator(inv.seat, next)
      api.info(`猎犬引导 ${inv.name} 朝「${api.locName(enemyLocation)}」移动一次。`)
    },
  }],
  modifiers: [],
}
