// 10509 轨道出口 · 地点（writtenInRock）
// 卡面：轨道出口不能被滑动或交换。（胜利 1。）
// 印刷数据由 definition 的 location() 从卡表读取；不可滑动/交换由 definition 的
// cannotBeSlidOrSwapped 与 behavior.canBeSlidOrSwapped 承接；进入即推进幕 2 目标。
export default {
  code: '10509',
  scope: 'location',
  implemented: true,
  flags: {
    printedShroud: 1,
    printedClues: 0,
    victory: 1,
    cannotBeSlidOrSwapped: true,
    railExit: true,
  },
  note: null,
  abilities: [],
}
