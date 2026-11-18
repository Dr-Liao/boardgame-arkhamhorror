// 10047 冲刺实验（Testing Sprint）· 探寻者事件 · 1 资源 · [[洞见]]/[[双重]]
// 卡面：
//   作为打出冲刺实验的额外费用，花费一个行动。
//   调查。按照隐藏值升序依次调查你所在地点和每个连接地点一次，直到你调查失败或成功调查了
//   每个符合条件的地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「[[双重]] 额外花费 1 行动」= played 描述子 cost { action: 1 }（P6 统一读点
//     ability.js#playedActionCost：legalMoves 候选 / validateMove 拦截 / doPlay 扣减三处同源）。
//   · 「调查。」= played 描述子 countsAs: 'investigate'。
//   · 「你所在地点和每个连接地点」= 当前地点 + connections（state.locations 的连接图）；
//     未揭示地点不能调查，因此 eligible 只收 revealed 地点。
//   · 「按隐藏值升序」= 按 location.shroud 排序；同一隐藏值的地点为玩家自选顺序（印刷原文允许），
//     用 api.choice 逐个询问。
//   · 「一次一个，直到失败」= 逐个 api.investigate(seat, { locationId })（actions.js#runInvestigate
//     接受 locationId，调查的是该地点），首次失败即停止。
const CODE = '10047'

function shroudOf(state, id) {
  const location = (state.locations || []).find(item => item.id === id)
  return location ? Number(location.shroud) || 0 : 0
}

export default {
  code: CODE,
  name: '冲刺实验',
  abilities: [
    {
      kind: 'played',
      id: 'testingSprintInvestigateChain',
      label: '调查你所在地点与每个连接地点（隐藏值升序，直到失败）',
      countsAs: 'investigate',
      cost: { action: 1 },
      resolve: ({ state, inv, api }) => {
        const here = (state.locations || []).find(location => location.id === inv.location)
        if (!here) return
        const seen = new Set()
        const eligible = []
        for (const id of [inv.location, ...(here.connections || [])]) {
          if (seen.has(id)) continue
          seen.add(id)
          const location = (state.locations || []).find(item => item.id === id)
          if (!location || location.revealed !== true || location.inPlay === false) continue
          eligible.push(id)
        }
        if (!eligible.length) {
          api.info('🧪 「冲刺实验」：没有可调查的地点。')
          return
        }
        const groups = new Map()
        for (const id of eligible) {
          const shroud = shroudOf(state, id)
          if (!groups.has(shroud)) groups.set(shroud, [])
          groups.get(shroud).push(id)
        }
        const ordered = []
        for (const shroud of [...groups.keys()].sort((left, right) => left - right)) {
          const pool = [...groups.get(shroud)]
          while (pool.length) {
            const id = pool.length === 1 ? pool[0] : api.choice({
              kind: 'location', source: CODE, seat: inv.seat,
              prompt: `「冲刺实验」：隐藏值 ${shroud} 的地点有多个，选择下一个调查的地点。`,
              options: pool.map(item => ({ id: item, label: api.locName(item) })),
            })
            const index = pool.indexOf(id)
            ordered.push(pool.splice(index < 0 ? 0 : index, 1)[0])
          }
        }
        api.info(`🧪 「冲刺实验」：按隐藏值升序调查 ${ordered.length} 个地点。`)
        for (const id of ordered) {
          const result = api.investigate(inv.seat, { locationId: id })
          if (!result?.success) {
            api.info(`🧪 「冲刺实验」：在「${api.locName(id)}」调查失败，停止。`)
            break
          }
        }
      },
    },
  ],
  modifiers: [],
}
