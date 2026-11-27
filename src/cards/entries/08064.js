// 08064 先见：在抽牌前公开指定牌名，抽中后由抽牌者选择是否取消或以减费打出。
const code = '08064'

export default {
  code,
  abilities: [{
    kind: 'played',
    fast: true,
    trigger: 'cardAboutToBeDrawn',
    label: '在同地点调查员抽牌前指定牌名，抽中可取消或少付 2 资源打出',
    criteria: ({ state, inv, context }) => Number.isInteger(context?.seat)
      && state.investigators[context.seat]?.location === inv.location,
    resolve: ({ inv, context, api }) => api.nameDrawPrediction(inv.seat, context, { source: code, discount: 2 }),
  }],
  modifiers: [],
}
