// 10582 真菌洞穴（Fungal Cave）· 放一边的岩穴地点（胜利 1）
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：[reaction] 你发现真菌洞穴的线索后：治愈 1 点伤害。（团队每轮仅限一次。）
//       强制 - 当一轮结束时：真菌洞穴的每个敌人治愈 2 点伤害。
// 背面（未揭示面）：作为你进入真菌洞穴的额外费用，你所在地点的调查员必须共同花费
//       2[per_investigator] 个线索。
//
// 一张卡一个文件：入场费在 behavior.investigatorEntryError + beforeMove；幕 2 目标与
// 幕 1 背面的放入在 behavior（placeFungalCaveAdjacent / checkObjectives）。
export default {
  code: '10582',
  scope: 'location',
  implemented: true,
  abilities: [],
  flags: {
    setAsideLocation: true,
    victory: 1,
    lair: true,
    enterCost: { perInvestigatorClues: 2 },
    reactionOnDiscoverClues: { healDamage: 1, groupLimitPerRound: true },
    roundEndEnemyHeal: 2,
    cluesPerInvestigator: 2,
    shroud: 4,
    traits: ['Cave', 'Lair', 'Dark'],
  },
  note: '近似：入场费在 beforeMove 里由「移动者所在地点的调查员共同支付」，与印刷的团队支付口径一致但未见引擎原生费用窗口。',
}
