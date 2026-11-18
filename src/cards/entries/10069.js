// 10069 银行劫案（Bank Job）· 潜袭者（Rogue）事件 · 2 费 · 0 级 · [[策略]]/[[双重]]/[[违法]]。
// 卡面：作为打出银行劫案的额外费用，花费一个行动。
//       你所在地点的调查员获得总计 8 资源，由你自由分配。
//
// 一卡一个文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 「作为额外费用，花费一个行动」→ Double 特质的统一读点：played 描述子 `cost: { action: 1 }`
//     （actions.js#doPlay / moves.js 与 playedActionCost 同源；资源费用仍由卡面 cost=2 支付）。
//   · 「你所在地点的调查员获得总计 8 资源」→ api.investigatorsAt + api.canGainResources 逐点分发；
//     每次用 api.gainResources（资源寄存/“不能获得资源”同一读点）。
const CODE = '10069'

const investigatorsHere = (state, inv) => (state.investigators || []).filter(other =>
  other && other.location === inv.location && !other.defeated && !other.resigned)

export default {
  code: CODE,
  playCondition: [{
    when: ({ state, inv }) => investigatorsHere(state, inv).length > 0,
    message: '你所在地点没有可以分配到资源的调查员',
  }],
  abilities: [
    {
      kind: 'played',
      cost: { action: 1 },
      label: '额外花费 1 行动：你所在地点的调查员共获得 8 资源，由你分配',
      resolve: ({ state, inv, api }) => {
        const candidates = investigatorsHere(state, inv).filter(other => api.canGainResources(other.seat))
        if (!candidates.length) {
          api.info('「银行劫案」：你所在地点没有能获得资源的调查员。')
          return
        }
        if (candidates.length === 1) {
          api.gainResources(candidates[0].seat, 8)
          api.info(`🏦 「银行劫案」：${candidates[0].name} 获得 8 资源。`)
          return
        }
        for (let point = 0; point < 8; point++) {
          const answer = api.choice({
            kind: 'effect', source: CODE, seat: inv.seat,
            prompt: `🏦 「银行劫案」：第 ${point + 1}/8 个资源分配给谁？`,
            options: candidates.map(other => ({ id: String(other.seat), label: `${other.name}（当前 ${other.resources} 资源）` })),
          })
          const seat = Number(answer)
          const target = candidates.find(other => other.seat === seat) || candidates[0]
          api.gainResources(target.seat, 1)
        }
        api.info('🏦 「银行劫案」：你所在地点的调查员共获得 8 资源。')
      },
    },
  ],
  modifiers: [],
}
