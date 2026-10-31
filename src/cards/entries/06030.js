// 06030 道尔女士
// 卡面：每套牌库仅限1张。
//       强制 - 道尔女士入场后：查找你的绑定卡牌，找出希望、热诚、预见。随机选择1张放置入场，
//       将其余2张混洗入你的牌库。在道尔女士离场时，找出上述每张支援(不论其是否在场)，
//       将其放在一边，位于场外。(FAQ，v2.0)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06030 道尔女士：
//   · 入场：api.bonded.retrieve(handCount:3) 把 3 张绑定支援取到手；api.random 随机选 1 张；
//     其余 2 张先混洗入牌库，再用 api.playCardFromHandFree 把选中的 1 张免费放置入场
//     （走完整 doPlay 入场管线，让 06031/32/33 自己的 entersPlay 强制效果结算）。
//   · 「其余的 2 张混洗入牌库」后，入场支援的强制（弃掉另外两张）会把它们从牌库弃掉——
//     这就是卡面最终状态（选中的 1 张在场，另 2 张在弃牌堆）。共用的强制逻辑写在各支援自己的条目里。
//   · 离场：api.bonded.return 把三张（即使在场/弃牌堆/牌库）收回场外集合 → 放在一边。
//   · 注意：playCardFromHandFree 内部走 doPlay，会扣 1 个行动点；这里用 api.gainAction 退回，
//     因为「放置入场」不消耗行动。

export default {
  code: '06030',
  abilities: [
    {
      kind: 'entersPlay',
      label: '检索希望/热诚/预见：随机 1 张放置入场，其余 2 张混洗入牌库',
      resolve: ({ inv, api }) => {
        const retrieved = api.bonded.retrieve(inv.seat, '06030', { handCount: 3 })
        const codes = [...new Set((retrieved || []).filter(code => ['06031', '06032', '06033'].includes(code)))]
        if (!codes.length) return
        const pick = codes[Math.floor(api.random() * codes.length)]
        const others = codes.filter(code => code !== pick)
        // 先把其余 2 张混洗入牌库（随后由入场支援的强制效果弃掉）。
        for (const code of others) {
          for (let guard = 0; guard < 4 && (inv.hand || []).includes(code); guard++) {
            api.moveCard({ code, from: 'hand', to: 'deckTop' })
          }
        }
        api.shuffleDeck(inv.seat)
        const actionsBefore = inv.actionsLeft
        if (api.playCardFromHandFree(inv.seat, pick)) {
          // 放置入场不消耗行动：退回 doPlay 内部扣掉的那 1 点。
          if ((inv.actionsLeft || 0) < actionsBefore) api.gainAction(inv.seat, 1)
          api.info(`「道尔女士」：随机将「${api.cardName(pick)}」放置入场，其余 2 张洗回牌库。`)
        }
      },
    },
    {
      kind: 'leavesPlay',
      label: '离场：把希望、热诚、预见收回场外集合',
      resolve: ({ inv, api }) => {
        api.bonded.return(inv.seat, '06030')
        api.info('「道尔女士」离场：希望、热诚、预见被放在一边。')
      },
    },
  ],
  modifiers: [],
}
