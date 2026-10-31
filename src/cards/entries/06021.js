// 06021 一瓣缟玛瑙
// 卡面：多重。快速。
//       [free]如果你有3张一瓣缟玛瑙在场上：将这些卡牌放在一边，位于场外。
//       查找你的绑定卡牌，找出皇后的挂坠，将其放置入场。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06021 一瓣缟玛瑙：
//   · 3 张同名支援在场时可用（criteria 计数，free 能力不耗行动）；
//   · 3 张移到 state.setAside（api.moveCard to:'setAside'，走通用区域搬运原语）；
//   · 绑定查找 06022：api.bonded.retrieve(seat, '06021') → 皇后的挂坠入手 → api.putIntoPlay 放置入场。

export default {
  code: '06021',
  fast: true,
  abilities: [
    {
      kind: 'free',
      label: '若有 3 张一瓣缟玛瑙在场：与其放在一边，找出皇后的挂坠并放置入场',
      cost: { action: false },
      criteria: [({ inv }) => (inv.assets || []).filter(item => item.code === '06021').length >= 3],
      resolve: ({ inv, api }) => {
        const copies = (inv.assets || []).filter(item => item.code === '06021').slice(0, 3)
        if (copies.length < 3) return
        for (const copy of copies) api.moveCard({ id: copy.id, from: 'play', to: 'setAside' })
        api.bonded.retrieve(inv.seat, '06021', { handCount: 1 })
        if ((inv.hand || []).includes('06022')) {
          api.putIntoPlay(inv.seat, '06022')
          api.info(`${inv.name} 将 3 张「一瓣缟玛瑙」放在一边，找出「皇后的挂坠」并放置入场。`)
        } else {
          api.info('「一瓣缟玛瑙」：没有找到「皇后的挂坠」。')
        }
      },
    },
  ],
  modifiers: [],
}
