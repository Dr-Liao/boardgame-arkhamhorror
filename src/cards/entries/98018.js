// 98018 亚兹塔罗（Yaztaroth）· 中立 · 诡计/弱点 · 诅咒/契约 · 替换（戴克斯特·德雷克）。
// 卡面（cards-data 98018）：
//   戴克斯特·德雷克牌库专用。替换。
//   显现 - 将亚兹塔罗放置入场，放到你的威胁区域。
//   你不能打出支援，也不能将支援放置入场。
//   [action][action]：弃掉亚兹塔罗。
//
// 引擎读点：
//   · 显现进威胁区 = weakness 描述子的 threat 档案；
//   · 「不能打出支援」= 条目级 threatEffect.cannotPlay: ['asset']（读点 turn-flow.js#cannotPlayTypes，
//     行动打出 / 效果打出 / 快速事件共用；与 12012 死灵之书同一实现）；
//   · [action][action] 弃掉 = threatEffect.discardCost: { action: 2 }（moves.js 的 discardThreat 行动枚举，
//     getThreatEffect 优先读条目级 threatEffect）。
// 近似：「也不能将支援放置入场（put into play）」目前没有独立的「放入场」禁止读点，
//   cannotPlay:['asset'] 只覆盖「打出」通道；效果类放置入场仍未拦截 →
//   primitive-requests/core-cards-a-98018-no-put-into-play.json。
const code = '98018'

export default {
  code,
  threatEffect: { cannotPlay: ['asset'], discardCost: { action: 2 } },
  abilities: [{
    kind: 'weakness',
    label: '亚兹塔罗：放置入你的威胁区域',
    weakness: { type: 'threat' },
  }],
  modifiers: [],
  note: '近似：「不能打出支援」已接线（threatEffect.cannotPlay 读点）；「不能将支援放置入场」缺独立的放入场禁止读点 → primitive-requests/core-cards-a-98018-no-put-into-play.json。',
}
