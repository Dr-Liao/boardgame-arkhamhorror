// 08523 狂风呼啸（A Harsh Wind Blows）· 议程 4 · 议程
// 归属：关卡专用 · edgeOfTheEarth/iceAndDeathPart2（lostInTheNight 组）。
// 背面：选择一张压在某个地点底下正面朝下的遭遇卡，查看其正面后放回（behavior.agendaAdvance）。
export default {
  code: '08523',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    chapterFlow: 'aHarshWindBlows',
    onAdvance: 'lookUnderLocation',
  },
}
