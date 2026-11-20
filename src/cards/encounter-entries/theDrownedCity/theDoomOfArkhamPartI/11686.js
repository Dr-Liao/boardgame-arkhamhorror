// 11686 兰道尔·蒂林哈斯特 · 欲取你性命 · 敌人（阿卡姆的毁灭 第一部分）。
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartI（P7 终章上篇）。
// 卡面：无情。反击。兰道尔·蒂林哈斯特不能移动，且蒂林哈斯特密所下方每有 1 张卡牌，
//       他得到 +1 战斗值和 +1[per_investigator] 生命值。
// 印刷：战斗 1 / 躲避 3 / 每调查员生命 1 / 伤害 1 / 恐惧 1 / 胜利 1 / [[Humanoid]][[Sorcerer]][[Elite]]。
// 读点：behavior.enemyStatModifier（战斗/生命按商店下方暗牌数）；「不能移动」在导入定义里
//       immobile，由引擎敌人移动读点消费（本关剧情不会主动移动他）。
export default {
  code: '11686',
  scope: 'enemy',
  implemented: true,
  flags: { fightPerBeneath: 1, healthPerInvestigatorPerBeneath: 1, immobile: true, relentless: true },
  note: '数据型条目 + 修正读点；approximation：无仇敌/无情的行为由引擎通用关键词处理。',
  abilities: [],
}
