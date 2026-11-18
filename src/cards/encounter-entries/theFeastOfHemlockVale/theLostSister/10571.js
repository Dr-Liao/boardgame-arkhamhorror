// 10571 黑暗围拢（Darkness Closes In）· 议程 2
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：[[黑暗]]地点的卡牌使用(黑夜)效果，其余地点使用(白日)效果。
// 背面：每位尚未撤退的幸存调查员被击败并承受 1 点精神创伤。
//
// 一张卡一个文件：毁灭阈值（12）与卡文由卡表/definition 读取，背面在
// behavior.agendaReveal 结算（defeatInvestigator + addTrauma(mental, 1)）。
export default {
  code: '10571',
  scope: 'agenda',
  implemented: true,
  abilities: [],
  flags: {
    agendaStage: 2,
    doomThreshold: 12,
    darkLocationsUseNight: true,
    defeatSurvivorsOnAdvance: true,
    mentalTraumaOnAdvance: 1,
  },
  note: '数据型条目：背面效果读点只有 agendaStage / mentalTraumaOnAdvance，判定在章节 behavior 里。',
}
