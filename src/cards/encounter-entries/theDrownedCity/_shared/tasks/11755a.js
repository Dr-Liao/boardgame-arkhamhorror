// 11755a 坚守底线 · 任务（Task）· 未完成面（弱点面）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11755a，原文见该卡 textZh）：
//   永久。
//   强制 - 你受到1点或更多伤害时：也在坚守底线上放置1点伤害。
//   强制 - 游戏结束时，如果本卡牌上的伤害数量等于或超过你的生命值上限：在剧本日志中，本任务下标记1点进度。
//
// 读点（声明即接线）：
//   · 「你受到 1 点或更多伤害时」= harmAssigned 窗口，criteria 读 context.seat === 自己且 context.damage > 0；
//   · 「也在本卡上放置 1 点伤害」= api.placeUse(source, 'damage', 1)（卡面具名计数器；本卡没有印刷
//     生命值，不能走 placeAssetHarm 的容量校验，用 useTokens.damage 计数）；
//   · 「游戏结束时…标记 1 点进度」= 引擎卡级 gameEnds 窗口（hub.endCampaign 派发）。条目声明
//     forced/trigger:gameEnds，resolve 用 api.maxHealth（有效生命上限）比较卡上伤害，
//     命中后 api.mechanics.progress.change 写入 +1；receipt='taskEnd-toeTheLine'，重复收尾去重。
//   · 两面同实体：flags.task.partnerCode 指向完成面 11755b；完成门限 5 点由战役层 interludes.resolveTasks 判定。
const CODE = '11755a'

const TASK = Object.freeze({
  id: 'toeTheLine',
  side: 'incomplete',
  face: 'weakness',
  partnerCode: '11755b',
  completedCard: '11755b',
  completedRecord: 'foundNewWork',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5, amount: 1, receipt: 'taskEnd-toeTheLine' }),
  tally: Object.freeze({ token: 'damage', initial: 0, on: ['harmAssigned'] }),
  endOfGame: Object.freeze({ kind: 'damageAtLeastMaxHealth', token: 'damage', settle: 'gameEnds' }),
})

export default {
  code: CODE,
  name: '坚守底线',
  scope: 'storyAsset',
  implemented: true,
  flags: { permanent: true, traits: ['Task', 'Incomplete'], task: TASK },
  abilities: [{
    kind: 'forced',
    trigger: 'harmAssigned',
    label: '在本卡上放置 1 点伤害',
    criteria: ({ inv, context }) => context?.seat === inv.seat && (context?.damage || 0) > 0,
    resolve: ({ inv, source, api }) => {
      const tokens = Number(api.placeUse(source, 'damage', 1)) || 0
      api.info('💥 ' + inv.name + ' 受到伤害：「坚守底线」放置 1 点伤害（当前 ' + tokens + '）。')
    },
  }, {
    kind: 'forced',
    trigger: 'gameEnds',
    label: '游戏结束：卡上伤害达到生命上限则本任务进度 +1',
    criteria: () => true,
    resolve: ({ inv, source, api }) => {
      const tokens = Number(source?.useTokens?.damage) || 0
      const maxHealth = Number(api.maxHealth?.(inv.seat) ?? inv.maxHealth ?? inv.health ?? 0)
      if (!(maxHealth > 0 && tokens >= maxHealth)) return false
      const next = api.mechanics?.progress?.change(TASK.progress.track, inv.seat, TASK.progress.amount, TASK.progress.receipt)
      if (next === false) return
      api.info('🏅 「坚守底线」：游戏结束时卡上伤害达到生命上限，本任务进度 +1。')
    },
  }],
  note: '①「受伤时放 1 点伤害」走 harmAssigned + api.placeUse（卡面无生命值，用 useTokens.damage 计数）；'
    + '②「游戏结束时本卡伤害 >= 生命上限则标记 1 点进度」走引擎卡级 gameEnds 窗口：resolve 用 api.maxHealth '
    + '比较卡上伤害，命中后 api.mechanics.progress.change 写入 +1；receipt=taskEnd-toeTheLine，重复收尾去重。无近似项。',
}
