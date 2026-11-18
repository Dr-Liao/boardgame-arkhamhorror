// 10570 深入洞穴（Into the Caves）· 议程 1
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：[[黑暗]]地点的卡牌使用(黑夜)效果，其余地点使用(白日)效果。
// 背面：在离最多调查员最近的[[海岸]]地点生成一张放一边的虾类混种（在光中面）；
//       每个在[[黑暗]]地点的调查员随机弃 1 张手牌；在议程 2a 上放等于当前天数的毁灭。
//
// 一张卡一个文件：阶段数值由 definition.stage()/doomThreshold 承担，背面结算在
// behavior.agendaReveal（读 agendaStage / 放一边敌人 / 天数毁灭）。
export default {
  code: '10570',
  scope: 'agenda',
  implemented: true,
  abilities: [],
  flags: {
    agendaStage: 1,
    doomThreshold: 4,
    darkLocationsUseNight: true,
    spawnSetAsideOnAdvance: 'crustaceanHybrid',
    spawnSide: 'light',
    spawnAtNearestCoastalToMostInvestigators: true,
    discardRandomCardAtDarkLocations: true,
    doomOnNextAgendaByDay: true,
  },
  note: '数据型条目：末日阈值与卡文由卡表/definition 读取，背面三段强制效果在 behavior.agendaReveal 结算。',
}
