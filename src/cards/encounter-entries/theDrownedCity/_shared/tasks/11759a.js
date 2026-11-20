// 11759a 毁灭之梦 · 任务（Task）· 未完成面（弱点面）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11759a，原文见该卡 textZh）：
//   永久。
//   强制 - 你受到1点或更多恐惧时：也在毁灭之梦上放置1点恐惧。
//   强制 - 游戏结束时，如果本卡牌上的恐惧数量等于或超过你的理智值上限：在剧本日志中，本任务下标记1点进度。
//
// 读点（声明即接线）：
//   · 「你受到 1 点或更多恐惧时」= harmAssigned 窗口，criteria 读 context.seat === 自己且 context.horror > 0；
//   · 「也在本卡上放置 1 点恐惧」= api.placeUse(source, 'horror', 1)（卡面无印刷神智值，用 useTokens.horror 计数）；
//   · 「游戏结束时…标记 1 点进度」= 引擎卡级 gameEnds 窗口（hub.endCampaign 派发）：forced/trigger:gameEnds，
//     resolve 用 api.maxSanity（有效理智上限）比较卡上恐惧，命中后 api.mechanics.progress.change 写入 +1；
//     receipt='taskEnd-dreamsOfDestruction'，重复收尾去重。
//   · 两面同实体：flags.task.partnerCode 指向完成面 11759b；完成门限 5 点由战役层 interludes.resolveTasks 判定。
const CODE = '11759a'

const TASK = Object.freeze({
  id: 'dreamsOfDestruction',
  side: 'incomplete',
  face: 'weakness',
  partnerCode: '11759b',
  completedCard: '11759b',
  completedRecord: 'understandsTheFuture',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5, amount: 1, receipt: 'taskEnd-dreamsOfDestruction' }),
  tally: Object.freeze({ token: 'horror', initial: 0, on: ['harmAssigned'] }),
  endOfGame: Object.freeze({ kind: 'horrorAtLeastMaxSanity', token: 'horror', settle: 'gameEnds' }),
})

export default {
  code: CODE,
  name: '毁灭之梦',
  scope: 'storyAsset',
  implemented: true,
  flags: { permanent: true, traits: ['Task', 'Incomplete'], task: TASK },
  abilities: [{
    kind: 'forced',
    trigger: 'harmAssigned',
    label: '在本卡上放置 1 点恐惧',
    criteria: ({ inv, context }) => context?.seat === inv.seat && (context?.horror || 0) > 0,
    resolve: ({ inv, source, api }) => {
      const tokens = Number(api.placeUse(source, 'horror', 1)) || 0
      api.info('🌑 ' + inv.name + ' 受到恐惧：「毁灭之梦」放置 1 点恐惧（当前 ' + tokens + '）。')
    },
  }, {
    kind: 'forced',
    trigger: 'gameEnds',
    label: '游戏结束：卡上恐惧达到理智上限则本任务进度 +1',
    criteria: () => true,
    resolve: ({ inv, source, api }) => {
      const tokens = Number(source?.useTokens?.horror) || 0
      const maxSanity = Number(api.maxSanity?.(inv.seat) ?? inv.maxSanity ?? inv.sanity ?? 0)
      if (!(maxSanity > 0 && tokens >= maxSanity)) return false
      const next = api.mechanics?.progress?.change(TASK.progress.track, inv.seat, TASK.progress.amount, TASK.progress.receipt)
      if (next === false) return
      api.info('🏅 「毁灭之梦」：游戏结束时卡上恐惧达到理智上限，本任务进度 +1。')
    },
  }],
  note: '①「受到恐惧时放 1 点恐惧」走 harmAssigned + api.placeUse（卡面无神智值，用 useTokens.horror 计数）；'
    + '②「游戏结束时本卡恐惧 >= 理智上限则标记 1 点进度」走引擎卡级 gameEnds 窗口：resolve 用 api.maxSanity '
    + '比较卡上恐惧，命中后 api.mechanics.progress.change 写入 +1；receipt=taskEnd-dreamsOfDestruction，重复收尾去重。'
    + '完成时的混乱袋 +1 标记由战役层 interludes.resolveTasks 处理，本卡不重复实现。无近似项。',
}
