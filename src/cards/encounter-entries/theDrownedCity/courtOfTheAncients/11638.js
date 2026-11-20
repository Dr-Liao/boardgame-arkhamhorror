// 11638 伊克雷希特碎片 · 剧情资产（每轮忽略首次[[星之眷族]]/[[深潜者]]攻击；[reaction] 敌人进入时横置它）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 近似：approximation：忽略首次攻击/横置敌人的被动能力尚未接线（缺剧情资产被动读点），当前只实现「控制 → 结局记录 shardOfYchlecht」。
export default {
  code: '11638',
  scope: 'storyAsset',
  implemented: true,
  flags: {"shardOfYchlecht":true},
  note: "approximation：忽略首次攻击/横置敌人的被动能力尚未接线（缺剧情资产被动读点），当前只实现「控制 → 结局记录 shardOfYchlecht」。",
  abilities: [],
}
