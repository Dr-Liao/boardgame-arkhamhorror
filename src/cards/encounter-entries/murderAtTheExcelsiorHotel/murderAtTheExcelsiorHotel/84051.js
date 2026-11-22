// 84051 · 精益酒店谋杀案（murderAtTheExcelsiorHotel）
// 归属：关卡专用 · murderAtTheExcelsiorHotel/murderAtTheExcelsiorHotel。
export default {
  code: '84051',
  scope: 'agenda',
  implemented: true,
  flags: {"culprit":true,"agendaIndex":3},
  note: "随机真凶议程（Setup 从 10 张中随机 1 张作为第 3 张议程，behavior.prepareScenario）。目标敌人= 次元蹒跚者（84035，近似）；目标被击败→结局 1（behavior.enemyDefeated），因毁灭阈值推进→结局 2（behavior.agendaReveal）。真凶卡正面授予迹象能力的文本未逐字接线。",
  abilities: [],
}
