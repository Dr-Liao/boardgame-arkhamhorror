// 10606 黑暗渐深 · 议程 1（theFeastOfHemlockVale/theTwistedHollow）
// 卡面：强制 - 在地点揭示后：从树林牌库顶将地点放置到该地点的上、下、左、右。
//     强制 - 在调查阶段结束时：每位在[[黑暗]]地点的调查员必须抽取躲避值最高且处于追击中的敌人，
//     或受到 1 点恐惧（不能被取消）。
// 背面「黑暗聚拢」：增加 1 资源到当前黑暗等级；6+ 且剧本模式时每位幸存调查员被击败并承受 1 点肉体创伤；
//     否则：黑暗地点上未交战的敌人进入追击、未揭示黑暗地点与树林牌库顶 2 张洗回、已揭示无人黑暗地点翻面、
//     在每位调查员四周铺树林、提灯持有者检定[willpower](X)，最后翻回议程 1a。
// 一张卡一个文件：议程没有逐卡能力，规则读点是章节 behavior 的
//   locationRevealed（揭示后铺树林）/ phaseBegan("enemy")（调查阶段结束）/ agendaReveal（背面）。

export default {
  code: '10606',
  scope: 'agenda',
  implemented: true,
  flags: {
    "agenda": "deepeningDark",
    "doomThreshold": 3,
    "darknessLevel": true,
    "revealPlacesWoods": true,
    "investigationEndPursuitOrHorror": true,
    "back": {
      "addDarkness": 1,
      "resetToFront": true,
      "finalDarkness": 6,
      "finalDarknessDefeats": true
    }
  },
  note: "近似：「持续效果随黑暗等级变化」在本关只落在骷髅标记与地点帷幕/揭示检定上（behavior 的 DARKNESS_X 读点）；引擎没有标记池级的 darkness 计数器。",
  abilities: [],
}
