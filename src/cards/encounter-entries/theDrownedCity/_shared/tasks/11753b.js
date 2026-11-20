// 11753b 没有比家更好的地方 · 任务（Task）· 完成面
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11753b，原文见该卡 textZh）：
//   永久。除非本任务已完成，否则其以弱点面朝上进场。
//   你在你的回合中可以额外进行一次行动，该行动仅可用于移动。
//
// 读点（声明即接线）：
//   · 「你的回合中可以额外进行一次行动」= modifiers 的 { target: 'actions', amount: 1 }（stats 的 actions 修正读点，与 10700 同一写法）；
//   · 「该行动仅可用于移动」= flags.task（extraAction: 'move'）里的印刷限制：引擎没有行动类型读点，属近似。
//   · 两面同实体：flags.task.partnerCode 指向未完成面 11753a；战役层在任务完成时用本卡替换它，
//     并把 foundTheirTrueHome 写进剧本日志（「除非本任务已完成，否则其以弱点面朝上进场」由战役层发哪一面决定）。
const CODE = '11753b'

const TASK = Object.freeze({
  id: 'noPlaceLikeHome',
  side: 'completed',
  face: 'completed',
  partnerCode: '11753a',
  replaces: '11753a',
  completedRecord: 'foundTheirTrueHome',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5 }),
  extraActionLimit: 'move',
})

export default {
  code: CODE,
  name: '没有比家更好的地方',
  scope: 'storyAsset',
  implemented: true,
  flags: { permanent: true, traits: ['Task', 'Completed'], controlBonus: { extraAction: 'move' }, task: TASK },
  modifiers: [{ target: 'actions', amount: 1 }],
  abilities: [],
  note: '近似：额外一次「仅可用于移动」的行动用 actions +1 修正承载（引擎没有行动类型读点，'
    + 'flags.task.extraAction 保留印刷限制供界面/审计读取）。',
}
