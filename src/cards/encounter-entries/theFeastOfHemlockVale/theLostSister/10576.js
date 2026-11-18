// 10576 悬墓（Suspended Graveyard）· 岩穴地点
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：[action] 受到 1 点恐惧：你翻遍墙上覆满骸骨的苔藓。把岩穴牌库顶的卡牌放进场，与本地点相邻。
//       （团队每场游戏仅限一次。）
//
// 一张卡一个文件：行动在 behavior.actions/performAction（lostSisterGraveyardDig:<id>），
// 读点：scenarioFlags.lostSisterGraveyardUsed（团队每场一次）+ placeCavernCardAdjacent。
export default {
  code: '10576',
  scope: 'location',
  implemented: true,
  abilities: [],
  flags: {
    groupLimitPerGame: true,
    digCost: { horror: 1 },
    cavernsDeckPlacement: 'adjacent',
    cluesPerInvestigator: 1,
    shroud: 4,
    traits: ['Cave', 'Coastal'],
  },
  note: '数据型条目：两行卡文的行为读点在章节 behavior（每场一次记在剧本标记上，不改地点字段）。',
}
