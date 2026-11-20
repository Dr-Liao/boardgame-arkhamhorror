// 11759b 毁灭之梦 · 任务（Task）· 完成面
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11759b，原文见该卡 textZh）：
//   永久。除非本任务已完成，否则其以弱点面朝上进场。
//   你得到1个额外法术槽位和理智值上限+2。
//
// 读点（声明即接线）：
//   · 「1 个额外法术槽位」= modifiers 的 { target: 'add:slot', value: 'arcane', amount: 1 }（slotBonus 读点，与 01070/02157 同一写法）；
//   · 「理智上限 +2」= modifiers 的 { target: 'maxSanity', amount: 2 }。
//   · 两面同实体：flags.task.partnerCode 指向未完成面 11759a；战役层在任务完成时用本卡替换它，
//     并把 understandsTheFuture 写进剧本日志（「除非本任务已完成，否则其以弱点面朝上进场」由战役层发哪一面决定）。
const CODE = '11759b'

const TASK = Object.freeze({
  id: 'dreamsOfDestruction',
  side: 'completed',
  face: 'completed',
  partnerCode: '11759a',
  replaces: '11759a',
  completedRecord: 'understandsTheFuture',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5 }),
})

export default {
  code: CODE,
  name: '毁灭之梦',
  scope: 'storyAsset',
  implemented: true,
  flags: { permanent: true, traits: ['Task', 'Completed'], task: TASK },
  modifiers: [{ target: 'add:slot', value: 'arcane', amount: 1 }, { target: 'maxSanity', amount: 2 }],
  abilities: [],
  note: '额外法术槽与理智上限都走修正管线（add:slot / maxSanity）；无近似项。',
}
