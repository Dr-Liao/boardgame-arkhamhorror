// 06293 真实与谎言（Truth and Lies，幕 4）
// 正面：[action] 花费 1 个线索：查看遭遇牌库顶的 3 张卡牌。
//       抽取这些卡牌中带有隐私关键词的每张卡牌，弃掉其余卡牌。
//       目标 - 将奈亚拉托提普放入胜利区，以找出并揭露它的真形。
//       如果胜利区有 1 + 1[per_investigator] 张奈亚拉托提普，推进。
// 背面（The True Shape）：若黑猫得知真相且调查员持有银钥匙：每位调查员失去所有线索；
//       胜利区的每张奈亚拉托提普合成一个敌人（攻/躲取最高、生命/伤害/恐惧/胜利取总和、获得全部关键词），
//       把「奈亚拉托提普的真形」生成在大礼堂；在每个被遗忘的高塔上放置线索直到其线索值。
//       否则进入结局 1。
//
// 行为位置：
//   · [action] → actRule.clueAction 数据，章节 behavior.actions / performAction 实现（读 encounterDeck 顶 3 张，
//     隐私卡用 hidden 手牌原语加入手牌、其余进遭遇弃牌堆）；
//   · 背面合成真形 → 章节 behavior.actReveal 读 `actRule.chapterFlow === 'trueShape'` 统一实现；
//   · 目标计数（胜利区的奈亚拉托提普张数）→ 章节 behavior.checkObjectives。
export default {
  code: '06293',
  scope: 'act',
  implemented: true,
  actRule: {
    chapterFlow: 'trueShape',
    clueAction: { rule: 'truthAndLiesLookTopThree', clues: 1, lookCount: 3 },
    truthShape: {
      role: 'nyarlathotepTrueShape',
      blackCatKnowsTruthRecord: 'theBlackCatKnowsTheTruth',
      silverKeyRecord: 'theInvestigatorsPossessTheSilverKey',
      spawnLocationCode: '06299',
    },
  },
}
