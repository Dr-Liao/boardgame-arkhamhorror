// 04230 古代巨石
// 卡面：研究完成。使用(X秘密)。X为“你鉴定了古代巨石”旁括号内的数字。
// 卡面：[reaction]在你抽取任意数量的卡牌时，花费等量的秘密：对你所在地点的一个敌人造成等量的伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04230 / 04231 古代巨石（研究完成）：抽牌后花等量秘密，造成伤害 / 治愈恐惧（读点在 campaignCardDrawReaction）。

export default {
  code: '04230',
  cardDrawSecretAction: 'damageEnemy',
  usesFromStoneRecord: true,
  usesType: 'secrets',
  // 「研究完成(Researched)」：升级/构筑前必须先在剧本里鉴定过古代巨石（记录由 04022 的鉴定调查写入）。
  researchRequirement: 'identifiedTheAncientStone',
  abilities: [

  ],
  modifiers: [

  ],
}
