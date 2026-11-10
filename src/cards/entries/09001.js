// 09001 卡森·辛克莱（Carson Sinclair）· 守卫者 · 管家
// 卡面：
//   你可以进行一次额外行动，该行动只能用于下面的 [action] 能力。
//   [action] 选择同地点的另一位调查员：其立即进行一次行动，如同现在是其回合。（对每位调查员每轮限一次）
//   [elder_sign] 效果：+0。抽 1 张牌。你可以在同地点另一位调查员结算其 [elder_sign] 效果时随时结算本效果。
//
// 读点：
//   · 额外行动：investigator.restrictedAction = { kind: 'crossSeatAction' }（turn.js 回合开始授予，
//     moves.js 的 freeAction 原语按 cost.action + restrictedKind 扣额度）；
//   · 立即行动：api.beginImmediateAction（通用原语，见 05156/06028/08062）；
//   · 每轮每人一次：api.investigatorTools.crossSeatGrantAvailable / recordCrossSeatGrant；
//   · 投入到他人检定：investigator.trackCommitToOther（tests.js 记账，09003 轮末强制读）。
export default {
  code: '09001',
  kind: 'investigator',
  investigator: {
    elderSign: { bonus: 0 },
    trackCommitToOther: true,
    restrictedAction: { kind: 'crossSeatAction' },
    freeAction: {
      id: 'carsonSinclairGrant',
      label: '🫱 [行动] 选择同地点另一位调查员：其立即执行一次行动（对每位调查员每轮限一次）',
      cost: { action: 1 },
      restrictedKind: 'crossSeatAction',
      resolve: ({ state, inv, api }) => {
        const candidates = api.investigatorsAt(inv.location)
          .filter(other => other.seat !== inv.seat)
          .filter(other => api.investigatorTools.crossSeatGrantAvailable(inv.seat, other.seat, state.round))
        if (!candidates.length) {
          api.info('卡森：本轮已没有可授权的调查员。')
          return
        }
        const chosen = candidates.length === 1 ? candidates[0].seat : Number(api.choice({
          kind: 'investigator', source: '09001', seat: inv.seat,
          prompt: '选择立即执行一次行动的同地点调查员。',
          options: candidates.map(other => ({ id: String(other.seat), label: other.name })),
        }))
        const target = state.investigators[Number(chosen)]
        if (!target) return
        api.investigatorTools.recordCrossSeatGrant(inv.seat, target.seat, state.round)
        api.info(`🫱 卡森授权 ${target.name} 立即执行一次行动。`)
        api.beginImmediateAction(target.seat, { source: '09001' })
      },
    },
  },
  elderSign: {
    id: '09001-eldersign',
    label: '卡森旧印：+0；抽 1 张牌（可在同地点队友结算旧印时随时结算）',
    resolve: () => ({ delta: 0, optionalDraw: 1 }),
  },
  abilities: [],
  modifiers: [],
}
