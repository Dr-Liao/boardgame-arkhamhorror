// 11753a 没有比家更好的地方 · 任务（Task）· 未完成面（弱点面）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11753a，原文见该卡 textZh）：
//   永久。使用(8发现)。
//   强制 - 你揭示一处地点或将一处地点放置入场时：从没有比家更好的地方上移除1个发现。
//   强制 - 游戏结束时，如果没有比家更好的地方上有不超过1[per_investigator]个发现：在剧本日志中，本任务下标记1点进度。
//
// 读点（声明即接线）：
//   · 「使用(8 发现)」= 条目 uses/usesType（永久卡开局由 setup.js 的 newPlayerAssetInstance 入场并按条目初始化）；
//   · 「你揭示一处地点或将一处地点放置入场」= locationRevealed / locationPlaced 窗口，criteria 限定 context.seat 是自己；
//   · 「移除 1 个发现」= cost { uses: 1 }（payAbilityCost 扣 uses，次数不足时该强制不结算）；
//   · 「游戏结束时…标记 1 点进度」= 引擎卡级 gameEnds 窗口（windows.js#gameEnds；hub.endCampaign 开场派发一次
//     reaction 窗口，受控剧情资产的 forced/reaction 能力在同一窗口结算）。条目声明 kind:'forced',
//     trigger:'gameEnds'，resolve 按印刷做最终判定（剩余发现 ≤ 1×人数），命中后用 P7 原语
//     api.mechanics.progress.change('tdcTask', seat, 1, receipt) 写入进度；
//     receipt = 'taskEnd-noPlaceLikeHome'（按调查员/轨道去重 → 重复收尾只结算一次）。
//   · 两面同实体：flags.task.partnerCode 指向完成面 11753b；完成门限 5 点由战役层 interludes.resolveTasks 判定。
const CODE = '11753a'

const TASK = Object.freeze({
  id: 'noPlaceLikeHome',
  side: 'incomplete',
  face: 'weakness',
  partnerCode: '11753b',
  completedCard: '11753b',
  completedRecord: 'foundTheirTrueHome',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5, amount: 1, receipt: 'taskEnd-noPlaceLikeHome' }),
  tally: Object.freeze({ token: 'discoveries', initial: 8, on: ['locationRevealed', 'locationPlaced'] }),
  endOfGame: Object.freeze({ kind: 'usesAtMostPerInvestigator', token: 'discoveries', perInvestigator: 1, settle: 'gameEnds' }),
})

const investigatorCount = state => Number(state.numInvestigators)
  || (state.investigators || []).filter(other => !other.defeated && !other.resigned).length

export default {
  code: CODE,
  name: '没有比家更好的地方',
  scope: 'storyAsset',
  implemented: true,
  uses: 8,
  usesType: 'discoveries',
  flags: { permanent: true, traits: ['Task', 'Incomplete'], task: TASK },
  abilities: [{
    kind: 'forced',
    trigger: ['locationRevealed', 'locationPlaced'],
    label: '移除 1 个发现',
    criteria: ({ inv, context }) => context?.seat === inv.seat,
    cost: { uses: 1 },
    resolve: ({ inv, api }) => api.info('🏚️ ' + inv.name + ' 揭示/放置地点：「没有比家更好的地方」移除 1 个发现。'),
  }, {
    kind: 'forced',
    trigger: 'gameEnds',
    label: '游戏结束：剩余发现不超过 1×人数则本任务进度 +1',
    criteria: ({ state, source }) => Number(source?.uses) <= (Number(TASK.endOfGame.perInvestigator) || 1) * investigatorCount(state),
    resolve: ({ inv, api }) => {
      const next = api.mechanics?.progress?.change(TASK.progress.track, inv.seat, TASK.progress.amount, TASK.progress.receipt)
      if (next === false) return
      api.info('🏅 「没有比家更好的地方」：游戏结束时剩余发现不超过 1×人数，本任务进度 +1。')
    },
  }],
  note: '①「使用(8 发现)」= 条目 uses/usesType；② 计时条款走 locationRevealed / locationPlaced + cost.uses；'
    + '③「游戏结束时…标记 1 点进度」走引擎卡级 gameEnds 窗口（hub.endCampaign 派发）：条目声明'
    + 'forced/trigger:gameEnds，resolve 按印刷判定（剩余发现 ≤1×人数）后用 api.mechanics.progress.change '
    + '写入 +1；receipt=taskEnd-noPlaceLikeHome，重复收尾自动去重。无近似项。',
}
