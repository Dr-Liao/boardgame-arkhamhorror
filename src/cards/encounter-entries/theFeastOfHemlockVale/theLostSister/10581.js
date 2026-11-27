// 10581 露天洞穴（Open Cave）· 岩穴地点（印刷 2 张）
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：[fast] 在你回合期间：检定[agility](2)。本地点每有一个重整的敌人，本检定 +1 难度。
//       如果你检定成功，露天洞穴失去[[黑暗]]特性，直到下个调查阶段开始（本地点的卡牌用(白日)效果）。
//       （团队每轮仅限一次。）
//
// 一张卡一个文件：行动在 behavior.actions/performAction（lostSisterOpenCaveLight:<id>），
// 熄暗记在 scenarioFlags.lostSisterLightUntil（phaseBegan/roundEnded 清除），随即 syncHybridAt 翻面。
export default {
  code: '10581',
  scope: 'location',
  implemented: true,
  abilities: [],
  flags: {
    canLoseDarkTrait: true,
    groupLimitPerRound: true,
    test: { skill: 'agility', baseDifficulty: 2, difficultyPerReadyEnemy: 1 },
    darkSuppressedUntil: 'nextInvestigationPhase',
    cluesPerInvestigator: 1,
    shroud: 3,
    traits: ['Cave', 'Dark'],
  }
}
