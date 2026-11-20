// 11755b 坚守底线 · 任务（Task）· 完成面
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11755b，原文见该卡 textZh）：
//   永久。除非本任务已完成，否则其以弱点面朝上进场。
//   你得到+1[combat]和生命值上限+2。
//
// 读点（声明即接线）：
//   · 「你得到 +1 战斗」= modifiers 的 { target: 'skill:combat', amount: 1 }；
//   · 「生命上限 +2」= modifiers 的 { target: 'maxHealth', amount: 2 }。
//   · 两面同实体：flags.task.partnerCode 指向未完成面 11755a；战役层在任务完成时用本卡替换它，
//     并把 foundNewWork 写进剧本日志（「除非本任务已完成，否则其以弱点面朝上进场」由战役层发哪一面决定）。
const CODE = '11755b'

const TASK = Object.freeze({
  id: 'toeTheLine',
  side: 'completed',
  face: 'completed',
  partnerCode: '11755a',
  replaces: '11755a',
  completedRecord: 'foundNewWork',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5 }),
})

export default {
  code: CODE,
  name: '坚守底线',
  scope: 'storyAsset',
  implemented: true,
  flags: { permanent: true, traits: ['Task', 'Completed'], task: TASK },
  modifiers: [{ target: 'skill:combat', amount: 1 }, { target: 'maxHealth', amount: 2 }],
  abilities: [],
  note: '两条修正都走 stats 的修正管线（skill:combat / maxHealth），无近似项。',
}
