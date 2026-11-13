// 09049 分析法（Analysis）· 探寻者（Seeker）技能 · 0 经验。
//
// 卡面：本次技能检定揭示混乱标记后，你可以将你的 1 个线索放到你所在地点，以取消该混乱标记，
//       将其放回混乱袋，并揭示一个新标记。（你可以执行任意次数。）
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 投入档：commit 描述子（skill 档案为纯数据，图标来自 cards-data）。
//   · 「揭示标记后取消并重抽」→ reaction 挂 tokenReveal 窗口（tests.js 的标记揭示段）：
//     已投入的技能卡由 ability-rules#descriptorSources 的 committed 分支枚举为能力来源，
//     因此它能在这个窗口里被问到；取消/替代由 api.replaceChaosToken 写回 context.replacementToken
//     （tests.js 会把原标记归还混乱袋并以新标记继续结算）。
//   · 费用「把你的 1 个线索放到你所在地点」→ api.spendClueToLocation（唯一读点：扣个人线索 + 放回地点）。
const CODE = '09049'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'commit',
      label: '分析法：投入本次技能检定（[wild] 图标）',
      skill: {},
    },
    {
      kind: 'reaction',
      trigger: 'tokenReveal',
      label: '揭示混乱标记后：把你的 1 个线索放到所在地点，取消该标记并重抽',
      criteria: [({ state, inv, source, context }) => {
        if (!state.skillTest || context?.replacementToken) return false
        const committed = (state.skillTest.committed || []).some(item => (item.code || item) === CODE)
        if (!committed && source?.code !== CODE) return false
        // 「你」= 检定者；他人检定不受本卡影响。
        if (state.skillTest.seat !== inv.seat) return false
        return (inv.clues || 0) > 0
      }],
      resolve: ({ inv, api, context }) => {
        if (!api.spendClueToLocation(inv.seat, 1)) return
        const [token] = api.revealChaosTokens(1)
        if (!token) {
          api.info('「分析法」：混乱袋里没有可以重新揭示的标记。')
          return
        }
        api.replaceChaosToken(context, token)
        api.info(`🔬 「分析法」：${inv.name} 把 1 个线索放到所在地点，取消该混乱标记并改为结算 ${api.tokenLabel(token)}。`)
      },
    },
  ],
  modifiers: [],
}
