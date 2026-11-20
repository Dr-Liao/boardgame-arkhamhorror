// 11510 萨迪·谢尔顿 · 敌人（金盆洗手，放一边；幕 1 背面生成）
// 归属：关卡专用 · theDrownedCity/oneLastJob。
// 卡面：反击。萨迪·谢尔顿不能移动，且得到 +1[per_investigator] 生命值。
//       萨迪·谢尔顿每有 1 点伤害，得到 +1 战斗值（最多 +3 战斗值）。
// 印刷：战斗 2 / 躲避 3 / 生命 4 / 伤害 2 / 恐惧 0 / 特性 [[Humanoid]][[Criminal]][[Syndicate]][[Elite]] / 胜利 1。
// 读点：behavior.enemyStatModifier 返回 health=+1/调查员、fight=min(3, 伤害)；
//       「反击」由 definition 解析卡文（retaliate=true，引擎 enemies.js 读 def.retaliate）；
//       「不能移动」由 definition 解析卡文（immobile=true，引擎 enemy-keyword-movement.js 读）。
export default {
  code: '11510',
  scope: 'enemy',
  implemented: true,
  note: '数据型条目：数值取卡表；生命/战斗修正读点 behavior.enemyStatModifier；'
    + '反击/不能移动由 definition 解析成 retaliate/immobile（引擎既有读点）。',
  abilities: [],
}
