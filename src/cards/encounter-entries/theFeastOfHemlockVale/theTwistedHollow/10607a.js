// 10607a 冥思苦想 · 幕 1（背面 = 类熊混种 10607b）（theFeastOfHemlockVale/theTwistedHollow）
// 卡面：每个没有生成指示的敌人获得「生成 - 在从遭遇牌库抽取本敌人时：将本敌人放置到追击区域。」
//     目标 - 当一轮结束时，如果所有调查员都在同一个[[巢穴]]地点，则可以共同花费所需数量的线索（3[per_investigator]）以推进。
// 背面：类熊混种现身（Codex Σ）——参考 Act/Cards/…/DesperateSearch.hs。

export default {
  code: '10607a',
  scope: 'act',
  implemented: true,
  flags: {
    "act": "desperateSearch",
    "actNumber": 1,
    "backCode": "10607b",
    "pursuitSpawnForEnemiesWithoutSpawn": true,
    "objective": {
      "type": "clues",
      "perInvestigator": 3,
      "sameLairLocation": true,
      "timing": "roundEnd"
    }
  },
  note: "近似：「没有生成指示的敌人进入追击」由 behavior.enemySpawned 在生成后立刻移入追击区域（净效果相同；入场/涌动窗口可能已结算）。",
  abilities: [],
}
