// 60553 猫科混种 · 米格尔的专属弱点（敌人）
// 卡面：逃逸。猎手。猎物（仅对米格尔·德·拉·克鲁兹）。
//       [猫科混种]免疫玩家卡牌效果。
//
// 读点：
//   · 关键词（逃逸/猎手/猎物=承受者）走条目级 enemyWeakness（引擎生成/移动/交战读点）；
//   · 「免疫玩家卡牌效果」= enemyRule.playerCardEffectImmune:true（批次 3 新增读点：
//     src/engine/effect-provenance.js 的 enemyEffectAllowed / enemyPlayerEffectBlocked 统一判断
//     当前效果来源 currentEffectSource；kind==='playerCard' 时拒绝伤害/交战/移动/躲避等玩家卡来源，
//     剧本/遭遇来源照常放行）。
const CODE = '60553'

export default {
  code: CODE,
  scope: 'enemy',
  implemented: true,
  enemyWeakness: { elusive: true, hunter: true, prey: 'bearer' },
  enemyRule: { playerCardEffectImmune: true },
  abilities: [],
  modifiers: [],
}
