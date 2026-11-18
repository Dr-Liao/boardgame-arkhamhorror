// 10513 扭曲隧道 · 地点（writtenInRock）
// 卡面：强制 - 矿车进入扭曲隧道后：移动矿车一次。（胜利 1。）
// 印刷数据由 definition 的 location() 从卡表读取；进入后的追加移动在
// behavior.moveMineCartOnce（depth 限制防止无限递归）。两张实体的轨道图标（东/西 与 北/东/南）
// 在 definition.RAIL_TABLE（warpedRailA/B）。
export default {
  code: '10513',
  scope: 'location',
  implemented: true,
  flags: {
    printedShroud: 2,
    printedCluesPerInvestigator: 2,
    victory: 1,
    quantity: 2,
    railIconFaces: [['east', 'west'], ['north', 'east', 'south']],
    warped: true,
    forcedMoveOnCartEnter: true,
  },
  note: null,
  abilities: [],
}
