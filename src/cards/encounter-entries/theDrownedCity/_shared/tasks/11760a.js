// 11760a 探究深渊 · 任务（Task）· 未完成面（弱点面）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11760a，原文见该卡 textZh）：
//   永久。使用(5痴迷)。
//   强制 - 你所在地点最后一个剩余线索被发现后：从探究深渊上移除1个痴迷。
//   强制 - 游戏结束时，如果探究深渊上没有痴迷：在剧本日志中，本任务下标记1点进度。
//
// 读点（声明即接线）：
//   · 「使用(5 痴迷)」= 条目 uses/usesType；
//   · 「你所在地点最后一个线索被发现后」= clueDiscovered 窗口（locations.js），context.lastClue 为真表示该地点线索归零；criteria 还要求 context.seat === 自己；
//   · 「移除 1 个痴迷」= cost { uses: 1 }。
//   · 两面同实体：flags.task.partnerCode 指向完成面 11760b；任务完成时战役层用 11760b
//     替换本卡，并把 learnedTheSecretTruth 写进剧本日志（参考 Helpers.hs#tasks / interludes.js#resolveTasks）。
//   · 每名调查员的任务进度只走 P7 原语 mechanics.progress（轨道 'tdcTask'，option = 任务 id），
//     不自造战役记录键；完成门限 5 点由战役层（TDC_TASK_COMPLETION_PROGRESS）判定。
//
// 近似 / 未接线（blocked read point）：
//   · 「游戏结束时……在剧本日志中本任务下标记 1 点进度」没有卡级窗口：引擎 finishScenario 只扫
//     手牌里的 traumaAtGameEndWhenInHand，不枚举在场的卡条目。因此本条目只把印刷判定声明为
//     flags.task.endOfGame；进度写入需由 Lead 在结局读点调用
//     api.mechanics.progress.change('tdcTask', seat, 1, '11760a:endOfGame') 结算。
//     8 张任务共用同一句模板（同句规则），不在单卡里各写一遍命令式逻辑。
const CODE = '11760a'

const TASK = Object.freeze({
  id: 'plumbTheDepths',
  side: 'incomplete',
  face: 'weakness',
  partnerCode: '11760b',
  completedCard: '11760b',
  completedRecord: 'learnedTheSecretTruth',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5, amount: 1, receipt: '11760a:endOfGame' }),
  tally: Object.freeze({'token':'obsessions','initial':5,'on':['clueDiscovered']}),
  endOfGame: Object.freeze({'kind':'usesAtMost','token':'obsessions','amount':0}),
})

export default {
  code: CODE,
  name: '探究深渊',
  scope: 'storyAsset',
  implemented: false,
  uses: 5,
  usesType: 'obsessions',
  flags: { permanent: true, traits: ['Task', 'Incomplete'], task: TASK },
  abilities: [{
    kind: 'forced',
    trigger: 'clueDiscovered',
    label: '移除 1 个痴迷',
    criteria: ({ inv, context }) => context?.seat === inv.seat && context?.lastClue === true,
    cost: { uses: 1 },
    resolve: ({ inv, api }) => api.info('🔍 ' + inv.name + ' 发现本地点最后一个线索：「探究深渊」移除 1 个痴迷。'),
  }],
  note: 'approximation / blocked read point：① 最后线索的判定已接线（clueDiscovered + context.lastClue + cost.uses）；'
    + '②「游戏结束时本卡没有痴迷则标记 1 点进度」没有卡级窗口，'
    + '进度需由结局读点用 api.mechanics.progress.change(\'tdcTask\', seat, 1, \'11760a:endOfGame\') 结算。',
}
