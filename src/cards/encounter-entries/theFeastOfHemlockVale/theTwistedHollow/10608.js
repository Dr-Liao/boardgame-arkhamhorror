// 10608 伯蒂在哪儿？ · 幕 2（theFeastOfHemlockVale/theTwistedHollow）
// 卡面：[fast] 花费 1 个线索：查看一个相邻地点的已揭示面。
//     目标 - 找到伯蒂·马斯格雷夫。他迷失在森林深处！(不要推进场景，直到你受到指示。)
// 推进：扭曲空洞地点（10621）的目标——轮末、全员在扭曲空洞、共同花费 2[per_investigator] 线索 → 幕 2b。
// 背面「才出虎口……」：伯蒂入场、未交战敌人进追击、除扭曲空洞外所有地点收回树林牌库按示意图重铺、
//     类熊混种治愈并生成在扭曲空洞、幕与议程都推进到特殊议程「回到山谷！」（毁灭随之转移）。

export default {
  code: '10608',
  scope: 'act',
  implemented: true,
  flags: {
    "act": "wheresBertie",
    "actNumber": 2,
    "backCode": null,
    "fastLookAdjacent": {
      "costClues": 1
    },
    "objective": {
      "type": "clues",
      "perInvestigator": 2,
      "allAtLocation": "theTwistedHollow",
      "timing": "roundEnd",
      "noAutoAdvance": true
    },
    "back": {
      "placeBertie": true,
      "pursuitUnengagedEnemies": true,
      "rebuildWoods": 13,
      "spawnUrsineAtHollow": true,
      "advanceToSpecialAgenda": "10609"
    }
  },
  note: "近似：目标「找到伯蒂」的推进由行为在轮末按扭曲空洞地点的目标结算（引擎 objective 无法表达「全员在同一地点 + 指定地点」的组合）。",
  abilities: [],
}
