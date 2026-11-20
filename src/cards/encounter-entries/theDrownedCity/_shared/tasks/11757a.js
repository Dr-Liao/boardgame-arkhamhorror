import { failedBy } from '../../../_shared.js'

// 11757a 证明你的价值 · 任务（Task）· 未完成面（弱点面）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11757a，原文见该卡 textZh）：
//   永久。使用(4机会)。
//   强制 - 你低于难度至少2点进行技能检定失败后：从证明你的价值上移除1个机会。
//   强制 - 游戏结束时，如果证明你的价值上有1个或更多机会：在剧本日志中，本任务下标记1点进度。
//
// 读点（声明即接线）：
//   · 「使用(4 机会)」= 条目 uses/usesType；
//   · 「以低于难度至少 2 点失败一次技能检定后」= testEnds 窗口（context.result 是标准检定结果），差值用 _shared 的 failedBy；
//   · 「移除 1 个机会」= cost { uses: 1 }；
//   · 「游戏结束时…标记 1 点进度」= 引擎卡级 gameEnds 窗口（hub.endCampaign 派发；第三轮落地）。
//     该条件**非单调**（机会会继续被移除），因此只能在这里做最终判定：条目声明 forced/trigger:gameEnds，
//     resolve 判定「剩余机会 ≥1」后 api.mechanics.progress.change 写入 +1；receipt='taskEnd-proveYourWorth'，
//     重复收尾由 receipt 去重，不会重复 +1。
//   · 两面同实体：flags.task.partnerCode 指向完成面 11757b；完成门限 5 点由战役层 interludes.resolveTasks 判定。
const CODE = '11757a'

const TASK = Object.freeze({
  id: 'proveYourWorth',
  side: 'incomplete',
  face: 'weakness',
  partnerCode: '11757b',
  completedCard: '11757b',
  completedRecord: 'pulledTheirWeight',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5, amount: 1, receipt: 'taskEnd-proveYourWorth' }),
  tally: Object.freeze({ token: 'chances', initial: 4, on: ['testEnds'] }),
  endOfGame: Object.freeze({ kind: 'usesAtLeast', token: 'chances', amount: 1, settle: 'gameEnds' }),
})

export default {
  code: CODE,
  name: '证明你的价值',
  scope: 'storyAsset',
  implemented: true,
  uses: 4,
  usesType: 'chances',
  flags: { permanent: true, traits: ['Task', 'Incomplete'], task: TASK },
  abilities: [{
    kind: 'forced',
    trigger: 'testEnds',
    label: '移除 1 个机会',
    criteria: ({ inv, context }) => {
      if (context?.seat !== inv.seat || !context?.result) return false
      const result = context.result
      if (result.autoFail || result.success) return Boolean(result.autoFail)
      return failedBy(result) >= 2
    },
    cost: { uses: 1 },
    resolve: ({ inv, api }) => api.info('📉 ' + inv.name + ' 检定失败至少 2 点：「证明你的价值」移除 1 个机会。'),
  }, {
    kind: 'forced',
    trigger: 'gameEnds',
    label: '游戏结束：仍有 ≥1 个机会则本任务进度 +1',
    criteria: () => true,
    resolve: ({ inv, source, api }) => {
      if ((Number(source?.uses) || 0) < (Number(TASK.endOfGame.amount) || 1)) return false
      const next = api.mechanics?.progress?.change(TASK.progress.track, inv.seat, TASK.progress.amount, TASK.progress.receipt)
      if (next === false) return
      api.info('🏅 「证明你的价值」：游戏结束时仍有 1 个或更多机会，本任务进度 +1。')
    },
  }],
  note: '① 失败差值 >= 2 的计时走 testEnds + failedBy（自爆失败视为失败）；'
    + '②「游戏结束时仍有 >= 1 个机会则标记 1 点进度」条件不单调，只能在 gameEnds 窗口做最终判定：'
    + '条目声明 forced/trigger:gameEnds，resolve 判定后 api.mechanics.progress.change 写入 +1；'
    + 'receipt=taskEnd-proveYourWorth，重复收尾由 receipt 去重。无近似项。',
}
