// 06339 阴谋破灭（幕 3）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面：[action] 花费 1 个线索：对你所在地点的一个[[古神]]敌人造成 3 点伤害。
//   强制 - 在神话阶段开始时：从混乱袋中随机揭示一个标记。如果该标记修正值为负值，
//     将阿特拉克·纳克亚顺时针旋转 X 次。X 为该负值修正值。
//   目标 - 如果阿特拉克·纳克亚被击败，推进。背面：（→R1）
// 接线（章节 behavior）：actions 同幕 2；phaseBegan('mythos') 读 mythosSpin（幕 3 旋转敌人本身）；
//   checkObjectives 读 enemyDefeatedFlag='atlachNachaDefeated'（06346 的 onDefeated 写该场景标记）；
//   actLeftPlay 读 advance.finish 调 api.finish('resolution1')。
export default {
  code: '06339',
  scope: 'act',
  implemented: true,
  actRule: {
    actions: { rule: 'spendClueDamageAncientOne', clueCost: 1, damage: 3, trait: 'Ancient One' },
    mythosSpin: true,
    objective: { kind: 'enemyDefeatedFlag', flag: 'atlachNachaDefeated' },
    advance: { finish: 'resolution1' },
  },
}
