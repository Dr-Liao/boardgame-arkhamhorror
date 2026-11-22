import { skillModifier } from './_shared.js'

const CODE = '60411'
const marginOptions = Array.from({ length: 1001 }, (_, margin) => ({
  id: String(margin),
  label: String(margin),
}))

export default {
  code: CODE,
  modifiers: [skillModifier('willpower', 1)],
  abilities: [{
    kind: 'reaction',
    trigger: 'testInitiated',
    label: '此处的检定开始后横置：猜中最终差值则抽 1 张牌',
    cost: { exhaust: true },
    criteria: ({ state, inv, context }) => state.investigators[context.seat]?.location === inv.location,
    resolve: ({ api, inv }) => {
      const margin = Number(api.choice({
        kind: 'amount', source: CODE, seat: inv.seat,
        prompt: '指定成功或失败的差值。',
        options: marginOptions,
      }))
      api.afterCurrentTest(result => {
        if (!result) return
        const difference = result.success ? result.summary?.successBy : result.summary?.failedBy
        if (difference === margin) api.drawCards(inv.seat, 1)
      })
    },
  }],
}
