// 10515 轨道岔路 · 地点（writtenInRock）
// 卡面：强制 - 轮末，如果矿车在轨道岔路：从剧本参考卡上弃掉 1 个道岔。
// 印刷数据由 definition 的 location() 从卡表读取（quantity 3，三张同图标 北/东/南/西）；
// 轮末效果在 behavior.roundEnded。
export default {
  code: '10515',
  scope: 'location',
  implemented: true,
  flags: {
    printedShroud: 3,
    printedCluesPerInvestigator: 2,
    quantity: 3,
    railIcons: ['north', 'east', 'south', 'west'],
    forked: true,
    roundEndRemoveSwitch: true,
  },
  note: null,
  abilities: [],
}
