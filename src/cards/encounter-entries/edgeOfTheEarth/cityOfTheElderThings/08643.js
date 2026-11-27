// 08643 复苏的古老者 · 猎手。交战时夺取数值钥匙，离场时遗留钥匙。
const CODE = '08643'

export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemyRule: { hunter: true, dropsValueKeys: true },
  abilities: [{
    kind: 'forced', trigger: 'enemyEngaged',
    label: '与你交战时：将你控制的一个钥匙放到复苏的古老者上',
    criteria: ({ source, context }) => context.enemy?.id === source.id,
    resolve: ({ source, context, api }) => {
      const holder = 'investigator:' + context.seat
      const keys = api.mechanics.keys.valueAt(holder)
      if (!keys.length) return
      const differentValues = [...new Set(keys.map(key => key.value))]
      const chosen = differentValues.length === 1 ? String(differentValues[0]) : api.choice({
        kind: 'effect', source: CODE, seat: context.seat, prompt: '选择放到复苏的古老者上的钥匙。',
        options: differentValues.map(value => ({ id: String(value), label: String(value) })),
      })
      const key = keys.find(key => String(key.value) === chosen)
      if (key) api.mechanics.keys.spendValue(holder, { values: [key.value], destination: 'enemy:' + source.id })
    },
  }, {
    kind: 'forced', trigger: 'cityKeyControlled',
    label: '同地点调查员控制钥匙时：复苏的古老者重整、交战并攻击该调查员',
    criteria: ({ source, context }) => source.location === context.location,
    resolve: ({ state, source, context, api }) => {
      api.scenario.readyEnemy(source)
      if (source.engagedSeat !== context.seat) api.scenario.engageAtInvestigator(source, context.seat)
      const investigator = state.investigators[context.seat]
      if (!investigator.defeated && !investigator.resigned) api.scenario.attack(source, investigator)
    },
  }],
}
