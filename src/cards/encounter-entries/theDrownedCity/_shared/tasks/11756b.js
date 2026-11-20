// 11756b 好钱 · 任务（Task）· 完成面
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11756b，原文见该卡 textZh）：
//   永久。除非本任务已完成，否则其以弱点面朝上进场。
//   你以5个额外资源开始游戏。
//
// 读点（声明即接线）：
//   · 「你以 5 个额外资源开始游戏」= 条目级 startingResources: 5（setup.js 的永久卡入路段读 registeredEntry(code).startingResources）。
//   · 两面同实体：flags.task.partnerCode 指向未完成面 11756a；战役层在任务完成时用本卡替换它，
//     并把 madeBank 写进剧本日志（「除非本任务已完成，否则其以弱点面朝上进场」由战役层发哪一面决定）。
const CODE = '11756b'

const TASK = Object.freeze({
  id: 'goodMoney',
  side: 'completed',
  face: 'completed',
  partnerCode: '11756a',
  replaces: '11756a',
  completedRecord: 'madeBank',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5 }),
})

export default {
  code: CODE,
  name: '好钱',
  scope: 'storyAsset',
  implemented: true,
  startingResources: 5,
  flags: { permanent: true, traits: ['Task', 'Completed'], task: TASK },
  modifiers: [],
  abilities: [],
  note: '「开局 +5 资源」由条目级 startingResources 读取（setup.js），无近似项。',
}
