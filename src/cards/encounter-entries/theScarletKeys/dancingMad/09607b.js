// 09607b 德西德柔·戴佳多·欧瓦瑞兹（Desiderio Delgado Álvarez）· storyAsset（剧情资产面）
//
// 归属：关卡专用 · theScarletKeys/dancingMad（P7）。
// 卡面（中）：[reaction]在[[怪物]]敌人的攻击对德西德柔·戴佳多·欧瓦瑞兹造成伤害时，横置他：
//   取消该伤害的 1 点，对攻击的敌人造成 1 点伤害。
//
// 读点（本章 `behavior.js`）：
//   · assetRule.monsterAttackDamageReduction → behavior.enemyAttackModifier：
//     [[怪物]] 敌人的攻击对控制者的伤害 -1（取消 1 点），同时横置他并对攻击的敌人造成 1 点伤害
//     （`monsterAttackRetaliate`）。
//   · 生命值走卡表（health 4）；剧情资产实例由 behavior.afterDeckSetup 放进调查员的支援区。
//
// 近似（逐条披露，见 behavior.scenarioApproximations）：引擎没有「支援受到攻击伤害时取消 1 点」
// 的通用窗口，因此把「取消 1 点」落在攻击伤害修正读点上（敌人攻击 resolver 的 damage 修正），
// 效果等价（攻击伤害 -1 且攻击者受到 1 点伤害），但触发时机早于「伤害分配」。
export default {
  code: '09607b',
  name: '德西德柔·戴佳多·欧瓦瑞兹',
  scope: 'storyAsset',
  implemented: true,
  note: '取消 1 点攻击伤害改在 enemyAttackModifier 读点结算（引擎无支援伤害取消窗口）；'
    + '横置与对攻击者的 1 点伤害在同一次结算里完成。',
  assetRule: {
    monsterAttackDamageReduction: 1,
    monsterAttackRetaliate: 1,
  },
}
