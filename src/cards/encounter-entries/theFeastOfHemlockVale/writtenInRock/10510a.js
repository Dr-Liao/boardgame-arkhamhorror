// 10510a 左转弯 · 地点（writtenInRock）
// 卡面：[action][action]：交换 2 个相邻[[轨道]]地点。（团队每局限一次。）
// 印刷数据由 definition 的 location() 从卡表读取；轨道图标（北/西）是章节几何数据，
// 在 definition 的 RAIL_TABLE。能力在 behavior.actions / performAction（writtenInRockTurnSwap）。
export default {
  code: '10510a',
  scope: 'location',
  implemented: true,
  flags: {
    printedShroud: 2,
    printedCluesPerInvestigator: 1,
    railIcons: ['north', 'west'],
    turnSwap: true,
    groupLimit: 'perGame',
  },
  note: null,
  abilities: [],
}
