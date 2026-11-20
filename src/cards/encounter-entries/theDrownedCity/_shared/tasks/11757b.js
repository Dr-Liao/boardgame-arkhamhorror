// 11757b 证明你的价值 · 任务（Task）· 完成面
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11757b，原文见该卡 textZh）：
//   永久。除非本任务已完成，否则其以弱点面朝上进场。
//   使用(3机会)。
//   [reaction]你所在地点的一次技能检定中揭示非[auto_fail]标记时，花费1个机会：取消该标记。
//
// 读点（声明即接线）：
//   · 「使用(3 机会)」= 条目 uses/usesType；
//   · 「你所在地点的一次技能检定中揭示非 autofail 标记时」= symbolRevealed 窗口（tests.js），criteria 读 context.location === 自己所在地点；
//   · 「花费 1 个机会：取消该标记」= cost { uses: 1 } + api.cancelCurrentSymbol(context, { sourceCode })（唯一取消标记读点）。
//   · 两面同实体：flags.task.partnerCode 指向未完成面 11757a；战役层在任务完成时用本卡替换它，
//     并把 pulledTheirWeight 写进剧本日志（「除非本任务已完成，否则其以弱点面朝上进场」由战役层发哪一面决定）。
const CODE = '11757b'

const TASK = Object.freeze({
  id: 'proveYourWorth',
  side: 'completed',
  face: 'completed',
  partnerCode: '11757a',
  replaces: '11757a',
  completedRecord: 'pulledTheirWeight',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5 }),
})

export default {
  code: CODE,
  name: '证明你的价值',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'chances',
  flags: { permanent: true, traits: ['Task', 'Completed'], task: TASK },
  modifiers: [],
  abilities: [{
    kind: 'reaction',
    trigger: 'symbolRevealed',
    label: '花费 1 个机会：取消该标记',
    criteria: ({ inv, context }) => context?.token !== 'autofail'
      && context?.location === inv.location,
    cost: { uses: 1 },
    resolve: ({ context, api }) => {
      if (!api.cancelCurrentSymbol(context, { sourceCode: CODE })) {
        api.info('「证明你的价值」：当前没有可取消的标记。')
        return
      }
      api.info('🛡️ 「证明你的价值」取消了本次检定的标记。')
    },
  }],
  note: '近似：取消走 symbolRevealed + api.cancelCurrentSymbol，只覆盖符号标记（skull/cultist/tablet/elderthing）；'
    + '印刷写「非 autofail 标记」也含数值标记，引擎没有取消数值标记的读点（取消数值标记等于改检定值，属新原语）。',
}
