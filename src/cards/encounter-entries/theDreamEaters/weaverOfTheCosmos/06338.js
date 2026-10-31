// 06338 编织宇宙（幕 2）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面：[action] 花费 1 个线索：对你所在地点的一个[[古神]]敌人造成 3 点伤害。
//   强制 - 在神话阶段开始时：从混乱袋中随机揭示一个标记。如果该标记修正值为负值，
//     将阿特拉克·纳克亚顺时针旋转 X 次。X 为该负值修正值。
//   目标 - 如果胜利区有 4 张阿特拉克·纳克亚之腿，推进。
// 背面：翻转阿特拉克·纳克亚的中心牌面至敌人面，放置在毁灭最多的地点。
// 接线（章节 behavior）：actions 列出 spendClueDamageAncientOne（扣 1 线索 + 3 伤害）；
//   phaseBegan('mythos') 读 mythosSpin 揭示标记并按负值旋转（幕 2 旋转四条腿）；
//   checkObjectives 读 legsInVictory（胜利区 4 张 06347–06350）；actLeftPlay 读
//   advance.flipAtlachNacha 生成敌人面（简化：没有中心牌面，直接在毁灭最多地点生成 06346）。
export default {
  code: '06338',
  scope: 'act',
  implemented: true,
  actRule: {
    actions: { rule: 'spendClueDamageAncientOne', clueCost: 1, damage: 3, trait: 'Ancient One' },
    mythosSpin: true,
    objective: { kind: 'legsInVictory', count: 4 },
    advance: { flipAtlachNacha: true },
  },
}
