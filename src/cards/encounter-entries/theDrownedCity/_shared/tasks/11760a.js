// 11760a 探究深渊 · 任务（Task）· 未完成面（弱点面）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11760a，原文见该卡 textZh）：
//   永久。使用(5痴迷)。
//   强制 - 你所在地点最后一个剩余线索被发现后：从探究深渊上移除1个痴迷。
//   强制 - 游戏结束时，如果探究深渊上没有痴迷：在剧本日志中，本任务下标记1点进度。
//
// 读点（声明即接线）：
//   · 「使用(5 痴迷)」= 条目 uses/usesType；
//   · 「你所在地点最后一个线索被发现后」= clueDiscovered 窗口，context.lastClue 为真表示该地点线索归零；
//     criteria 还要求 context.seat === 自己；
//   · 「移除 1 个痴迷」= cost { uses: 1 }；
//   · 「游戏结束时…标记 1 点进度」= 引擎卡级 gameEnds 窗口（hub.endCampaign 派发）：forced/trigger:gameEnds，
//     resolve 判定「痴迷归零」后 api.mechanics.progress.change 写入 +1；receipt='taskEnd-plumbTheDepths'，重复收尾去重。
//   · 两面同实体：flags.task.partnerCode 指向完成面 11760b；完成门限 5 点由战役层 interludes.resolveTasks 判定。
const CODE = '11760a'

const TASK = Object.freeze({
  id: 'plumbTheDepths',
  side: 'incomplete',
  face: 'weakness',
  partnerCode: '11760b',
  completedCard: '11760b',
  completedRecord: 'learnedTheSecretTruth',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5, amount: 1, receipt: 'taskEnd-plumbTheDepths' }),
  tally: Object.freeze({ token: 'obsessions', initial: 5, on: ['clueDiscovered'] }),
  endOfGame: Object.freeze({ kind: 'usesAtMost', token: 'obsessions', amount: 0, settle: 'gameEnds' }),
})

export default {
  code: CODE,
  name: '探究深渊',
  scope: 'storyAsset',
  implemented: true,
  uses: 5,
  usesType: 'obsessions',
  flags: { permanent: true, traits: ['Task', 'Incomplete'], task: TASK },
  abilities: [{
    kind: 'forced',
    trigger: 'clueDiscovered',
    label: '移除 1 个痴迷',
    criteria: ({ inv, context }) => context?.seat === inv.seat && context?.lastClue === true,
    cost: { uses: 1 },
    resolve: ({ inv, source, api }) => api.info('🔍 ' + inv.name + ' 发现本地点最后一个线索：「探究深渊」移除 1 个痴迷（剩余 ' + (Number(source?.uses) || 0) + '）。'),
  }, {
    kind: 'forced',
    trigger: 'gameEnds',
    label: '游戏结束：痴迷归零则本任务进度 +1',
    criteria: () => true,
    resolve: ({ inv, source, api }) => {
      if ((Number(source?.uses) || 0) !== 0) return false
      const next = api.mechanics?.progress?.change(TASK.progress.track, inv.seat, TASK.progress.amount, TASK.progress.receipt)
      if (next === false) return
      api.info('🏅 「探究深渊」：游戏结束时痴迷已全部移除，本任务进度 +1。')
    },
  }],
  note: '① 最后线索判定走 clueDiscovered + context.lastClue + cost.uses；'
    + '②「游戏结束时没有痴迷则标记 1 点进度」走引擎卡级 gameEnds 窗口：resolve 判定后 api.mechanics.progress.change '
    + '写入 +1；receipt=taskEnd-plumbTheDepths，重复收尾去重。无近似项。',
}
