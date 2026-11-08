// 08005 伊波恩之书（Livre d'Eibon）· 诺曼专属支援。
//
// 卡面：
//   [fast] 横置伊波恩之书：用你一张手牌交换你牌库顶的卡牌。
//   [fast] 横置伊波恩之书：将你牌库顶的卡牌投入到你所在地点一位调查员执行的符合条件的技能检定中。
//
// 引擎读点：
//   · 换牌：牌库顶状态由 P2 `eote-deck-top.js` 维护（scenarioFlags.mechanics.eote.deckTop）；
//     用 api.moveCard + api.deckTop.clear/reveal 组合完成。
//   · 投入牌库顶：由 flags.deckTopCommit 声明本卡提供「牌库顶投入」通道；引擎在技能检定
//     的投入窗口里枚举（play-channels.js#commitEntries），并统一走 canCommitToTest 的
//     合法性检查（图标匹配/额外费用/限制）、同地点限制（队友投入窗口只开给同地点调查员）、
//     按本次检定技能过滤图标、投入后重新揭示新的牌库顶（scenarioFlag 同步）。
//     本条目不再写第二份 resolve，避免同一条规则两处实现。
export default {
  code: '08005',
  flags: { deckTopCommit: true },
  abilities: [
    {
      kind: 'free',
      cost: { exhaust: true },
      label: '交换牌库顶与一张手牌',
      criteria: ({ inv, state }) => {
        const record = state?.scenarioFlags?.mechanics?.eote?.deckTop?.seats?.[inv.seat] || null
        return Boolean(record) && (inv.hand || []).length > 0
      },
      resolve: ({ inv, state, api }) => {
        const record = state?.scenarioFlags?.mechanics?.eote?.deckTop?.seats?.[inv.seat] || null
        if (!record) return false
        const codes = [...new Set(inv.hand)]
        if (!codes.length) return false
        const options = codes.map(code => ({ id: code, label: api.cardName(code) }))
        const answer = options.length === 1 ? options[0].id
          : api.choice({ kind: 'effect', source: '08005', seat: inv.seat, prompt: '选择与牌库顶交换的手牌', options })
        if (!codes.includes(answer)) return false
        // 座位限定：换顶只能动「你」的牌库/手牌（ownerSeat 同时限定来源搜索与目的地归属）。
        const movedDown = api.moveCard({ code: record.code, from: 'deck', to: 'hand', ownerSeat: inv.seat }, { seat: inv.seat })
        const movedUp = movedDown && api.moveCard({ code: answer, from: 'hand', to: 'deckTop', ownerSeat: inv.seat }, { seat: inv.seat })
        if (!movedUp) return false
        api.deckTop.clear(inv.seat)
        api.deckTop.reveal(inv.seat, { public: false, discount: 1 })
        return true
      },
    },
  ],
}
