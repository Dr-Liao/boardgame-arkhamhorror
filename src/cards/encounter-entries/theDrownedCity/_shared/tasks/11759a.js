// 11759a 毁灭之梦 · 任务（Task）· 未完成面（弱点面）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11759a，原文见该卡 textZh）：
//   永久。
//   强制 - 你受到1点或更多恐惧时：也在毁灭之梦上放置1点恐惧。
//   强制 - 游戏结束时，如果本卡牌上的恐惧数量等于或超过你的理智值上限：在剧本日志中，本任务下标记1点进度。
//
// 读点（声明即接线）：
//   · 「你受到 1 点或更多恐惧时」= harmAssigned 窗口（enemies.js 的 applyHarm），criteria 读 context.seat === 自己且 context.horror > 0；
//   · 「也在本卡上放置 1 点恐惧」= api.placeAssetHarm(source, { horror: 1 })。
//   · 两面同实体：flags.task.partnerCode 指向完成面 11759b；任务完成时战役层用 11759b
//     替换本卡，并把 understandsTheFuture 写进剧本日志（参考 Helpers.hs#tasks / interludes.js#resolveTasks）。
//   · 每名调查员的任务进度只走 P7 原语 mechanics.progress（轨道 'tdcTask'，option = 任务 id），
//     不自造战役记录键；完成门限 5 点由战役层（TDC_TASK_COMPLETION_PROGRESS）判定。
//
// 近似 / 未接线（blocked read point）：
//   · 「游戏结束时……在剧本日志中本任务下标记 1 点进度」没有卡级窗口：引擎 finishScenario 只扫
//     手牌里的 traumaAtGameEndWhenInHand，不枚举在场的卡条目。因此本条目只把印刷判定声明为
//     flags.task.endOfGame；进度写入需由 Lead 在结局读点调用
//     api.mechanics.progress.change('tdcTask', seat, 1, '11759a:endOfGame') 结算。
//     8 张任务共用同一句模板（同句规则），不在单卡里各写一遍命令式逻辑。
const CODE = '11759a'

const TASK = Object.freeze({
  id: 'dreamsOfDestruction',
  side: 'incomplete',
  face: 'weakness',
  partnerCode: '11759b',
  completedCard: '11759b',
  completedRecord: 'understandsTheFuture',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5, amount: 1, receipt: '11759a:endOfGame' }),
  tally: Object.freeze({'token':'horror','initial':0,'on':['harmAssigned']}),
  endOfGame: Object.freeze({'kind':'horrorAtLeastMaxSanity'}),
})

export default {
  code: CODE,
  name: '毁灭之梦',
  scope: 'storyAsset',
  implemented: false,
  flags: { permanent: true, traits: ['Task', 'Incomplete'], task: TASK },
  abilities: [{
    kind: 'forced',
    trigger: 'harmAssigned',
    label: '在本卡上放置 1 点恐惧',
    criteria: ({ inv, context }) => context?.seat === inv.seat && (context?.horror || 0) > 0,
    resolve: ({ inv, source, api }) => {
      api.placeAssetHarm(source, { horror: 1 })
      api.info('🌑 ' + inv.name + ' 受到恐惧：「毁灭之梦」放置 1 点恐惧。')
    },
  }],
  note: 'approximation / blocked read point：①「受到恐惧时放 1 点恐惧」已接线（harmAssigned + placeAssetHarm）；'
    + '②「游戏结束时本卡恐惧 >= 理智上限则标记 1 点进度」没有卡级窗口，'
    + '进度需由结局读点用 api.mechanics.progress.change(\'tdcTask\', seat, 1, \'11759a:endOfGame\') 结算；'
    + '完成时的混乱袋 +1 标记由战役层 interludes.resolveTasks 处理，本卡不重复实现。',
}
