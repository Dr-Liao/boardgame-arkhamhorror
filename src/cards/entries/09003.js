// 09003「自私的错」（Selfless to a Fault）· 诡计 · 卡森专属弱点
// 卡面：显现 - 将本卡放入你的威胁区域。
//   强制 - 在你的回合结束时，若你本回合没有把至少 1 张牌投入到其他调查员执行的技能检定：
//   受到 1 点恐惧，并将本卡洗回你的牌库。
//
// 读点：commit 记账由 tests.js#noteCommitToOther 写入（investigator.trackCommitToOther）；
//   威胁区卡牌的 forced 描述子在回合结束窗口可用。
export default {
  code: '09003',
  abilities: [
    {
      kind: 'weakness',
      label: '显现：将「自私的错」放入你的威胁区域',
      weakness: { type: 'threat' },
    },
    {
      kind: 'forced',
      trigger: 'turnEnded',
      label: '回合结束且未投入到他人检定时：受到 1 点恐惧并洗回牌库',
      criteria: [({ state, inv, context }) => context?.seat === inv.seat
        && !(state.investigators[inv.seat]?.committedToOtherThisTurn?.round === state.round)],
      resolve: ({ inv, api }) => {
        api.harm(inv.seat, { horror: 1 })
        api.moveCard({ code: '09003', from: 'threat', to: 'deck', ownerSeat: inv.seat })
        api.shuffleDeck(inv.seat)
        api.info('「自私的错」被洗回卡森的牌库。')
      },
    },
  ],
  modifiers: [],
}
