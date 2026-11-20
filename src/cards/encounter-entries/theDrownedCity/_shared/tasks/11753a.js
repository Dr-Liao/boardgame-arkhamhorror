// 11753a 没有比家更好的地方 · 任务（Task）· 未完成面（弱点面）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11753a，原文见该卡 textZh）：
//   永久。使用(8发现)。
//   强制 - 你揭示一处地点或将一处地点放置入场时：从没有比家更好的地方上移除1个发现。
//   强制 - 游戏结束时，如果没有比家更好的地方上有不超过1[per_investigator]个发现：在剧本日志中，本任务下标记1点进度。
//
// 读点（声明即接线）：
//   · 「使用(8 发现)」= 条目 uses/usesType（永久卡开局由 setup.js 的 newPlayerAssetInstance 入场并按条目初始化）；
//   · 「你揭示一处地点或将一处地点放置入场」= locationRevealed / locationPlaced 窗口（locations.js 的 revealLocation / placeLocation），criteria 限定 context.seat 是自己；
//   · 「移除 1 个发现」= cost { uses: 1 }（payAbilityCost 扣 uses，次数不足时该强制不结算）。
//   · 两面同实体：flags.task.partnerCode 指向完成面 11753b；任务完成时战役层用 11753b
//     替换本卡，并把 foundTheirTrueHome 写进剧本日志（参考 Helpers.hs#tasks / interludes.js#resolveTasks）。
//   · 每名调查员的任务进度只走 P7 原语 mechanics.progress（轨道 'tdcTask'，option = 任务 id），
//     不自造战役记录键；完成门限 5 点由战役层（TDC_TASK_COMPLETION_PROGRESS）判定。
//
// 近似 / 未接线（blocked read point）：
//   · 「游戏结束时……在剧本日志中本任务下标记 1 点进度」没有卡级窗口：引擎 finishScenario 只扫
//     手牌里的 traumaAtGameEndWhenInHand，不枚举在场的卡条目。因此本条目只把印刷判定声明为
//     flags.task.endOfGame；进度写入需由 Lead 在结局读点调用
//     api.mechanics.progress.change('tdcTask', seat, 1, '11753a:endOfGame') 结算。
//     8 张任务共用同一句模板（同句规则），不在单卡里各写一遍命令式逻辑。
const CODE = '11753a'

const TASK = Object.freeze({
  id: 'noPlaceLikeHome',
  side: 'incomplete',
  face: 'weakness',
  partnerCode: '11753b',
  completedCard: '11753b',
  completedRecord: 'foundTheirTrueHome',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5, amount: 1, receipt: '11753a:endOfGame' }),
  tally: Object.freeze({'token':'discoveries','initial':8,'on':['locationRevealed','locationPlaced']}),
  endOfGame: Object.freeze({'kind':'usesAtMostPerInvestigator','token':'discoveries','perInvestigator':1}),
})

export default {
  code: CODE,
  name: '没有比家更好的地方',
  scope: 'storyAsset',
  implemented: false,
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
  }],
  note: 'approximation / blocked read point：①「使用(8 发现)」= 条目 uses/usesType；'
    + '② 计时条款已接线（locationRevealed / locationPlaced 窗口 + cost.uses）；'
    + '③「游戏结束时按发现数标记 1 点进度」没有卡级读点（见文件头），进度需由结局读点用 '
    + 'api.mechanics.progress.change(\'tdcTask\', seat, 1, \'11753a:endOfGame\') 结算。',
}
