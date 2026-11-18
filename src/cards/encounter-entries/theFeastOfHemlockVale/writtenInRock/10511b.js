// 10511b 右转弯 · 地点（writtenInRock）
// 卡面：[action] 花费 2 资源：把一个地点滑入与它相邻的空格。（团队每局限一次。）
// 印刷数据由 definition 的 location() 从卡表读取；能力在 behavior.actions / performAction
// （writtenInRockTurnSlide）。
export default {
  code: '10511b',
  scope: 'location',
  implemented: true,
  flags: {
    printedShroud: 2,
    printedCluesPerInvestigator: 1,
    railIcons: ['east', 'south'],
    turnSlide: true,
    resourceCost: 2,
    groupLimit: 'perGame',
  },
  note: null,
  abilities: [],
}
