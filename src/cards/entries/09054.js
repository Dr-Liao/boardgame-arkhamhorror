// 09054 威廉·T·马尔森博士（Dr. William T. Maleson）· 探寻者（Seeker）资产 · 2 经验 · 盟友。
//
// 卡面：[reaction] 在任意调查员从遭遇牌库抽取一张遭遇卡牌时，横置威廉·T·马尔森博士并把你的一个
//       线索放在你的地点：该调查员从遭遇牌库顶再抽取一张卡牌，在 2 张卡牌中选择一张结算，
//       取消并弃掉另一张。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 触发时机 → encounterDrawn 窗口（encounter.js 抽到遭遇卡后开窗，context 带 seat/cardCode）。
//   · 费用「横置 + 把 1 个线索放在你的地点」→ cost.exhaust + resolve 里的 api.spendClueToLocation
//     （唯一写点：扣个人线索、把线索放到所在地点）。
//   · 「再抽一张、2 选 1、取消并弃掉另一张」→ 先只读查看遭遇牌库顶（api.encounterDeckCards），
//     按玩家选择：要原卡 → api.discardEncounterTop 弃掉新卡；要新卡 → 置 context.cancelled 取消原卡，
//     再用 api.drawEncounter 结算新卡（遭遇牌库顶仍是它）。
const CODE = '09054'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'encounterDrawn',
      cost: { exhaust: true },
      label: '任意调查员抽到遭遇卡时：横置并把 1 个线索放到你的地点，该调查员 2 选 1 结算',
      criteria: [({ state, inv, source, context }) => {
        if (!source || source.exhausted) return false
        if (!Number.isInteger(context?.seat)) return false
        if (!(inv.clues > 0)) return false
        const drawer = state.investigators[context.seat]
        if (!drawer || drawer.defeated || drawer.resigned) return false
        return (state.encounterDeck || []).length > 0
      }],
      resolve: ({ state, inv, api, context }) => {
        const drawer = state.investigators[context.seat]
        if (!drawer) return
        const deck = api.encounterDeckCards()
        const nextCode = deck[deck.length - 1]
        if (!nextCode) {
          api.info('「威廉·T·马尔森博士」：遭遇牌库没有第二张卡牌。')
          return
        }
        if (!api.spendClueToLocation(inv.seat, 1)) return
        const drawnCode = context.cardCode || null
        const answer = api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: `${drawer.name}：结算哪一张遭遇卡？（另一张被取消并弃掉）`,
          options: [
            { id: 'drawn', label: `结算已抽到的${drawnCode ? `「${api.cardName(drawnCode)}」` : '卡牌'}`, cardCode: drawnCode || undefined },
            { id: 'top', label: `结算牌库顶的「${api.cardName(nextCode)}」`, cardCode: nextCode },
          ],
        })
        if (answer === 'top') {
          context.cancelled = true
          api.info(`🎩 「威廉·T·马尔森博士」：取消「${drawnCode ? api.cardName(drawnCode) : '已抽到的卡牌'}」，改为结算「${api.cardName(nextCode)}」。`)
          api.drawEncounter(drawer.seat)
          return
        }
        api.discardEncounterTop(1)
        api.info(`🎩 「威廉·T·马尔森博士」：弃掉牌库顶的「${api.cardName(nextCode)}」，照常结算已抽到的卡牌。`)
      },
    },
  ],
  modifiers: [],
}
