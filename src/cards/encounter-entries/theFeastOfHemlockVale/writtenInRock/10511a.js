// 10511a 右转弯 · 地点（writtenInRock）
// 卡面：[action][action]：交换 2 个相邻[[轨道]]地点。（团队每局限一次。）
// 印刷数据由 definition 的 location() 从卡表读取；能力在 behavior.actions / performAction
// （writtenInRockTurnSwap）。
export default {
  code: '10511a',
  scope: 'location',
  implemented: true,
  flags: {
    printedShroud: 2,
    printedCluesPerInvestigator: 1,
    railIcons: ['east', 'south'],
    turnSwap: true,
    groupLimit: 'perGame',
  },
  note: null,
  abilities: [],
}
