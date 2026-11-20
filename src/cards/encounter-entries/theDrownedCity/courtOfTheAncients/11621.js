// 11621 扭曲栈桥 · 地点（向西路线开场地点；敌军伤害后弃手牌强制、击败敌人后弃遭遇牌找符文）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 读点：behavior.enemyAttackResolved（扭曲栈桥敌人攻击后弃 1 张手牌，强制）、
//       behavior.enemyDefeated（在本地点击败敌人后弃 X 张遭遇牌并抽取其中 1 张[[符文]]卡）。
export default {
  code: '11621',
  scope: 'location',
  implemented: true,
  flags: {"resignV1":true},
  note: "数据型条目：地点数值取卡表；两条印刷强制/反应在 behavior.enemyAttackResolved / enemyDefeated。",
  abilities: [],
}
