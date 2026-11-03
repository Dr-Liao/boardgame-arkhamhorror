// 06096 幻梦境月食（Dreamlands Eclipse，诡计，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：dreamlands（TSK）。
// 卡面：Revelation - 将幻梦境月食放置入场，放在密谋牌库旁。
//       强制 - 在你发起一次调查时：你必须要么受到 1 点恐惧，要么本次调查你所在地点 +2 帷幕。
//       强制 - 当一轮结束时：弃掉幻梦境月食。
// 实现：用 api.putNextToAgenda 放在密谋牌库旁；发起调查时由旁置诡计读点询问二选一，
//   轮末由 discardAtRoundEnd 自动弃掉。
export default {
  code: '06096',
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    discardAtRoundEnd: true,
    onInvestigationInitiated(state, inv, source, api) {
      const answer = api.choose?.({
        kind: 'effect', source: '06096', seat: inv.seat,
        prompt: '幻梦境月食：受到 1 点恐惧，或使本次调查地点帷幕 +2？',
        options: [
          { id: 'horror', label: '受到 1 点恐惧' },
          { id: 'shroud', label: '本次调查地点帷幕 +2' },
        ],
      })
      if (answer === 'horror') {
        api.horror?.(inv.seat, 1)
        return 0
      }
      return 2
    },
  },
  encounterResolve(state, inv, card, api) {
    api.putNextToAgenda?.('06096', { originalCode: '06096' })
    api.info?.('🌑 「幻梦境月食」被放在密谋牌库旁。')
    return true
  },
}
