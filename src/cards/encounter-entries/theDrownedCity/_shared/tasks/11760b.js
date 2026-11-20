// 11760b 探究深渊 · 任务（Task）· 完成面
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11760b，原文见该卡 textZh）：
//   永久。除非本任务已完成，否则其以弱点面朝上进场。
//   你得到+1[intellect]。
//   [reaction]你所在地点最后一个线索被发现后，横置探究深渊：抽取1张卡牌。
//
// 读点（声明即接线）：
//   · 「你得到 +1 智力」= modifiers 的 { target: 'skill:intellect', amount: 1 }；
//   · 「你所在地点最后一个线索被发现后，横置本卡：抽 1 张牌」= clueDiscovered 窗口（context.lastClue）+ cost { exhaust: true } + api.drawCards。
//   · 两面同实体：flags.task.partnerCode 指向未完成面 11760a；战役层在任务完成时用本卡替换它，
//     并把 learnedTheSecretTruth 写进剧本日志（「除非本任务已完成，否则其以弱点面朝上进场」由战役层发哪一面决定）。
const CODE = '11760b'

const TASK = Object.freeze({
  id: 'plumbTheDepths',
  side: 'completed',
  face: 'completed',
  partnerCode: '11760a',
  replaces: '11760a',
  completedRecord: 'learnedTheSecretTruth',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5 }),
})

export default {
  code: CODE,
  name: '探究深渊',
  scope: 'storyAsset',
  implemented: true,
  flags: { permanent: true, traits: ['Task', 'Completed'], task: TASK },
  modifiers: [{ target: 'skill:intellect', amount: 1 }],
  abilities: [{
    kind: 'reaction',
    trigger: 'clueDiscovered',
    label: '横置：抽 1 张牌',
    criteria: ({ inv, context }) => context?.seat === inv.seat && context?.lastClue === true,
    cost: { exhaust: true },
    resolve: ({ inv, api }) => {
      api.drawCards(inv.seat, 1)
      api.info('🃏 ' + inv.name + ' 发现本地点最后一个线索：「探究深渊」抽 1 张牌。')
    },
  }],
  note: '最后线索反应与智力修正都已接线（clueDiscovered + context.lastClue + exhaust + drawCards）；无近似项。',
}
