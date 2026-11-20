// 11511 内奥米·欧巴尼恩 · 敌人（金盆洗手，放一边；幕 1 背面生成）
// 归属：关卡专用 · theDrownedCity/oneLastJob。
// 卡面：警戒。内奥米·欧巴尼恩不能移动，且得到 +1[per_investigator] 生命值。
//       强制 - 每轮中，内奥米·欧巴尼恩首次被成功躲避后：重整她。位于她所在地点的任意调查员
//       可以受到 1 点伤害，以取消本效果。
// 印刷：战斗 3 / 躲避 4 / 生命 4 / 伤害 2 / 恐惧 0 / 特性 [[Humanoid]][[Criminal]][[Syndicate]][[Elite]] / 胜利 1。
// 读点：behavior.enemyStatModifier 返回 health=+1/调查员；警戒由 definition 解析（alert=true）；
//       不能移动由 definition 解析（immobile=true）。
export default {
  code: '11511',
  scope: 'enemy',
  implemented: true,
  note: '数据型条目：数值取卡表；生命修正读点 behavior.enemyStatModifier；'
    + '警戒/不能移动由 definition 解析成 alert/immobile（引擎既有读点）。'
    + '「每轮首次被成功躲避后重整；同地点任一调查员可受 1 伤害取消」由 behavior.afterEvade 实现（actions-extra.js 既有读点，取消由 api.choose 选择）。',
  abilities: [],
}
