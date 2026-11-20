// 11757b 证明你的价值 · 任务（Task）· 完成面
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11757b，原文见该卡 textZh）：
//   永久。除非本任务已完成，否则其以弱点面朝上进场。
//   使用(3机会)。
//   [reaction]你所在地点的一次技能检定中揭示非[auto_fail]标记时，花费1个机会：取消该标记。
//
// 读点（声明即接线，第七轮补齐「任意类型标记」）：
//   · 「使用(3 机会)」= 条目 uses/usesType；
//   · 「你所在地点的一次技能检定中揭示非 autofail 标记时」= tokenEffectWouldResolve 反应窗口
//     （tests.js：揭示标记后、效果结算前派发；context 带 { seat, location, token }）；
//   · 「花费 1 个机会：取消该标记」= cost { uses: 1 } + resolve 里设置 `context.cancelled = true`
//     （tests.js 读到 cancelled 后该标记效果不结算、计入已揭示，与「返袋重抽」语义分离）；
//   · autofail 不可取消（criteria 排除）。
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
    trigger: 'tokenEffectWouldResolve',
    label: '花费 1 个机会：取消本次检定的标记效果',
    criteria: ({ inv, source, context }) => Boolean(context?.token)
      && context.token !== 'autofail'
      && context?.seat === inv.seat
      && context?.location === inv.location
      && (Number(source?.uses) || 0) > 0,
    cost: { uses: 1 },
    resolve: ({ context, api }) => {
      if (!context) return false
      context.cancelled = true
      api.info('🛡️ 「证明你的价值」：花 1 个机会，取消了本次检定揭示的标记效果。')
    },
  }],
  note: '「取消该标记」改为 tokenEffectWouldResolve 反应窗口：criteria 要求非 autofail、同地点、'
    + '本次检定且机会数 > 0；cost { uses: 1 } 花 1 个机会；resolve 设置 context.cancelled=true 后'
    + 'tests.js 会跳过该标记的效果结算并计入已揭示（与返袋重抽分离）。符号与数值标记统一处理，'
    + 'autofail 不可取消。第八轮修复了取消分支「取消后再抽标记」缺陷后，端到端用例已覆盖：'
    + '单标记袋 [\'-2\'] 取消后不抛错、标记效果不结算（检定值 3 vs 未取消的 1）、'
    + 'autofail 时不出现在候选、uses 3→2。无近似项。',
}
