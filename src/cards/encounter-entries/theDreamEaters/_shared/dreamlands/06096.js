// 06096 幻梦境月食（Dreamlands Eclipse，诡计，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：dreamlands（TSK）。
// 卡面：Revelation - 将幻梦境月食放置入场，放在密谋牌库旁。
//       强制 - 在你发起一次调查时：你必须要么受到 1 点恐惧，要么本次调查你所在地点 +2 帷幕。
//       强制 - 当一轮结束时：弃掉幻梦境月食。
// 实现：用 api.attachToAgenda 挂在当前密谋上（「密谋牌库旁」的近似载体）；
//   「发起调查时二选一」需要 beforeInvestigate 数据分派、「轮末弃掉」需要 roundEnded 遍历
//   密谋附属 → 已登记 coordinator request。数据写在 flags 上，接线即生效。
export default {
  code: '06096',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    api.attachToAgenda?.('06096', { originalCode: '06096' })
    api.info?.('🌑 「幻梦境月食」被放在密谋牌库旁。')
    return true
  },
  flags: {
    investigateChoice: { horror: 1, shroud: 2 },
    discardAtRoundEnd: true,
  },
  simplified: true,
  note: '调查时二选一与轮末弃牌需要共享层 beforeInvestigate/roundEnded 的数据分派；已登记 coordinator request。',
}
