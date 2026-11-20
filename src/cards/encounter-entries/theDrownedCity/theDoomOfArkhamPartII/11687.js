// 11687 约翰·雷蒙德·勒格拉斯 · 追寻答案 · 盟友剧情资产（阿卡姆的毁灭 第一部分）。
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartI（P7 终章上篇）。
// 卡面：你攻击[[深潜者]]和[[星之眷族]]敌人时，技能值 +1。
//       [reaction] 你在攻击或躲避克苏鲁期间进行技能检定时，横置约翰·雷蒙德·勒格拉斯：
//       本次检定技能值 +X，其中 X 为克苏鲁的狂怒值。
// 印刷：盟友 / 生命 3 / [[Ally]][[Detective]]。
// 状态：**仅有数据，行为未接线**（被动 +1 需要玩家支援层的「对特性敌人在场修正」读点，
//       反应需要「攻击/躲避克苏鲁」检定上下文；本批次不新增引擎读点，如实标 implemented: false）。
// Setup 读点：behavior.afterDeckSetup 直接以 api.giveAsset 入场并豁免盟友槽。
export default {
  code: '11687',
  scope: 'storyAsset',
  implemented: false,
  flags: { storyAlly: true, allySlotExempt: true },
  note: '数据型条目：入场的盟友槽豁免在 behavior.afterDeckSetup；卡面被动/反应未接线（近似见 worker 报告）。',
  abilities: [],
}
