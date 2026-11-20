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
//   · 「以低于难度至少 2 点失败一次技能检定后」= testEnds 窗口（tests.js 的 reactionWindow('testEnds')，context.result 是标准检定结果），差值用 _shared 的 failedBy；
//   · 「移除 1 个机会」= cost { uses: 1 }。
//   · 两面同实体：flags.task.partnerCode 指向完成面 11757b；任务完成时战役层用 11757b
//     替换本卡，并把 pulledTheirWeight 写进剧本日志（参考 Helpers.hs#tasks / interludes.js#resolveTasks）。
//   · 每名调查员的任务进度只走 P7 原语 mechanics.progress（轨道 'tdcTask'，option = 任务 id），
//     不自造战役记录键；完成门限 5 点由战役层（TDC_TASK_COMPLETION_PROGRESS）判定。
//
// 近似 / 未接线（blocked read point）：
//   · 「游戏结束时……在剧本日志中本任务下标记 1 点进度」没有卡级窗口：引擎 finishScenario 只扫
//     手牌里的 traumaAtGameEndWhenInHand，不枚举在场的卡条目。因此本条目只把印刷判定声明为
//     flags.task.endOfGame；进度写入需由 Lead 在结局读点调用
//     api.mechanics.progress.change('tdcTask', seat, 1, '11757a:endOfGame') 结算。
//     8 张任务共用同一句模板（同句规则），不在单卡里各写一遍命令式逻辑。
const CODE = '11757a'

const TASK = Object.freeze({
  id: 'proveYourWorth',
  side: 'incomplete',
  face: 'weakness',
  partnerCode: '11757b',
  completedCard: '11757b',
  completedRecord: 'pulledTheirWeight',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5, amount: 1, receipt: '11757a:endOfGame' }),
  tally: Object.freeze({'token':'chances','initial':4,'on':['testEnds']}),
  endOfGame: Object.freeze({'kind':'usesAtLeast','token':'chances','amount':1}),
})

export default {
  code: CODE,
  name: '证明你的价值',
  scope: 'storyAsset',
  implemented: false,
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
  }],
  note: 'approximation / blocked read point：① 失败差值 >= 2 的判定已接线（testEnds + failedBy，自爆失败视为失败）；'
    + '②「游戏结束时仍有 >= 1 个机会则标记 1 点进度」没有卡级窗口，'
    + '进度需由结局读点用 api.mechanics.progress.change(\'tdcTask\', seat, 1, \'11757a:endOfGame\') 结算。',
}
