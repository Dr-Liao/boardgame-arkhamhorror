// 11688 黏土恐怖 · 梦之雕塑 · [[神器]]剧情资产（阿卡姆的毁灭 第一部分）。
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartI（P7 终章上篇）。
// 卡面：每名[[星之眷族]]敌人失去巡逻和其印刷的猎物指示，并获得猎手和「猎物 - 你」。
//       [tdc_rune_u]·[tdc_rune_x]·[tdc_rune_o]·[tdc_rune_o]·[tdc_rune_d]·[tdc_rune_f]·[tdc_rune_z]
//       [fast] 横置黏土恐怖：将本支援的印刷文本框视为空白，直到本轮结束（除特性外），
//       或将一名[[星之眷族]]敌人向任意方向移动一次。
// 印刷：[[Item]][[Artifact]][[R'lyeh]]；本关争夺目标（结局 1 时若被控制则记录「黏土恐怖」）。
// 状态：**仅有数据，行为未接线**（星之眷族关键词改写 / 文本空白化 / 移动敌人需要新的
//       玩家支援层读点；本批次不新增，如实标 implemented: false）。
// 读点：behavior.artifactsControlled（flag.artifact：控制它计入「控制 ≥1 张神器」与结局记录）。
export default {
  code: '11688',
  scope: 'storyAsset',
  implemented: false,
  flags: { artifact: true, artifactGoal: true },
  note: '数据型条目：flag.artifact 参与幕目标与结局 1 的「黏土恐怖被控制」记录；卡面能力未接线。',
  abilities: [],
}
