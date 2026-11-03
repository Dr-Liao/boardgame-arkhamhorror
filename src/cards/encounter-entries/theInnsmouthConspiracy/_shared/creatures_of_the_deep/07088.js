export default {
  code: '07088', scope: 'enemy',
  abilities: [{ kind: 'forced', trigger: 'enemyEngaged', label: '深潜者蛮牛：弃掉一张手牌',
    criteria: ({ source, context }) => source.id === context.enemy?.id,
    resolve: ({ context, api }) => api.discardChosen(context.seat, 1, '07088') },
  { kind: 'forced', trigger: 'enemyDefeated', label: '深潜者蛮牛：逼近击败同类的调查员',
    criteria: ({ state, source, context }) => source.id !== context.enemy?.id
      && context.enemy?.traits?.includes('Deep One') && state.investigators[context.seat]
      && !state.investigators[context.seat].defeated && !state.investigators[context.seat].resigned,
    resolve: ({ state, source, context, api }) => {
      api.scenario.readyEnemy(source)
      const next = api.scenario.stepToward(source.location, state.investigators[context.seat].location)
      if (next && next !== source.location) api.moveEnemy(source, next)
    } }],
}
