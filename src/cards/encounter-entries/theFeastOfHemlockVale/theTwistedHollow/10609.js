// 10609 回到山谷！ · 特殊议程（同时是当前幕与当前议程）（theFeastOfHemlockVale/theTwistedHollow）
// 卡面：[fast] 横置山谷提灯或共同花费 1[per_investigator] 个线索：查看一个相邻地点的已揭示面，你可以移动到该地点。
//     目标 - 如果所有未被击败的调查员都撤退，(→结局1)。
// 背面「饥渴的森林」：增加 1 资源到当前黑暗等级；6+ 时每位幸存调查员被击败并承受 1 点肉体创伤 (→结局2)；
//     否则按玩家顺序，每位玩家选择一个追击中的敌人在最近的[[黑暗]]地点生成，不能则弃遭遇牌直到敌人。翻回正面。
// 触发：幕 2 背面「才出虎口……」把幕与议程都推进到本卡（behavior.outOfTheFryingPan）。

export default {
  code: '10609',
  scope: 'agenda',
  implemented: true,
  flags: {
    "specialAgenda": true,
    "bothActAndAgenda": true,
    "doomThreshold": 3,
    "fastAction": {
      "orCost": [
        "exhaustValeLantern",
        "groupCluesPerInvestigator:1"
      ],
      "lookAdjacentAndMayMove": true
    },
    "objective": {
      "allUndefeatedInvestigatorsResigned": "resolution1"
    },
    "back": {
      "addDarkness": 1,
      "resetToFront": true,
      "finalDarkness": 6,
      "finalDarknessDefeats": "resolution2"
    }
  },
  note: "近似：[fast] 行动与「既是幕也是议程」由 behavior（actions/performAction、outOfTheFryingPan）承接；卡表把本卡登记为 agenda 类型，幕实例由章节按同一卡面克隆；背面「弃遭遇牌直到敌人」在没有引擎抽牌管线时用本地敌人构造兜底。",
  abilities: [],
}
