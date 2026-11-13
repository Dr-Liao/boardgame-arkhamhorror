// 09001 卡森·辛克莱（Carson Sinclair）· 守卫者 · 管家
// 卡面：
//   你可以进行一次额外行动，该行动只能用于下面的 [action] 能力。
//   [action] 选择同地点的另一位调查员：其立即进行一次行动，如同现在是其回合。（对每位调查员每轮限一次）
//   [elder_sign] 效果：+0。抽 1 张牌。你可以在同地点另一位调查员结算其 [elder_sign] 效果时随时结算本效果。
//
// 读点（卡面 → 引擎读点）：
//   · 额外行动：investigator.restrictedAction = { kind: 'crossSeatAction' }（turn.js 回合开始授予，
//     moves.js 的 freeAction 原语按 cost.action + restrictedKind 扣额度）；
//   · 立即行动：api.beginImmediateAction（api-misc.js:810 → engine.js#performImmediateAction：
//     临时把 currentSeat 切到目标、给 1 行动、枚举合法行动并立刻结算）；
//   · 每轮每人一次 + 跨座位授权：P1-7 修正——原先条目写 `inv.crossSeatGrants`
//     （api.investigatorTools.recordCrossSeatGrant），但观察投影 mechanic-view.js:230-240 读的是
//     `scenarioFlags.mechanics.tsk.crossSeat.grants`（tsk-investigator.js 的场景级容器），
//     两处双源导致面板永不出现。现在改为单一事实源：写/读都走场景级原语
//     api.mechanics.tsk.investigator.grantAction/actionPending/takeAction，
//     「本轮已授权」通过场景容器的 grants 记录判断（只读 state，不新造字段）；
//   · 授权在目标行动结束后由 api.mechanics.tsk.investigator.takeAction 标记已用，
//     避免过期授权留在投影里污染面板；
//   · 投入到他人检定：investigator.trackCommitToOther（tests.js 记账，09003 轮末强制读）。
//
// 缺口（列给主进程）：`takeCrossSeatAction` 目前没有任何引擎调用点，本卡侧显式调用；
// `crossSeatActionPending` 不按轮次过滤（上一轮未用的授权会在后续轮次继续显示），
// 以及 `beginImmediateAction` 的「目标行动窗口」是否需要开 `tskCrossSeatAction` 窗口，
// 属于引擎投影/窗口读点，已在汇报中列出。
const SCENARIO_GRANTS_PATH = state => state?.scenarioFlags?.mechanics?.tsk?.crossSeat?.grants || {}
const currentRound = state => (Number.isSafeInteger(state?.round) ? state.round : 0)

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
        const crossSeat = api.mechanics?.tsk?.investigator
        if (!crossSeat) {
          api.info('卡森：TSK 场景扩展未接线，无法授权跨座位行动。')
          return
        }
        const round = currentRound(state)
        // 候选：同地点、别的座位、本轮还没收到过授权（读场景容器的 grants，与投影同一事实源）。
        const candidates = api.investigatorsAt(inv.location)
          .filter(other => other.seat !== inv.seat)
          .filter(other => !(SCENARIO_GRANTS_PATH(state)[other.seat] || []).some(grant => grant.round === round))
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
        // 单一事实源：写场景级 crossSeat 容器（观察投影读同一份数据）。
        crossSeat.grantAction({ fromSeat: inv.seat, targetSeat: target.seat })
        api.info(`🫱 卡森授权 ${target.name} 立即执行一次行动。`)
        try {
          api.beginImmediateAction(target.seat, { source: '09001' })
        } finally {
          // 无论目标是否真的执行成功，授权都已给出并消费：标记已用，避免过期授权留在投影里。
          crossSeat.takeAction(target.seat)
        }
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
