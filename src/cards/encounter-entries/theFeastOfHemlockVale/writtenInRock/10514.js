// 10514 沉没隧道 · 地点（writtenInRock）
// 卡面：强制 - 沉没隧道揭示后：从遭遇牌库顶弃牌直到弃出一张敌人。队长抽取该敌人。
// 印刷数据由 definition 的 location() 从卡表读取；效果在 behavior.locationRevealed。
// 两张实体的轨道图标（东/南/西 与 北/东/南）在 definition.RAIL_TABLE（sunkenRailA/B）。
export default {
  code: '10514',
  scope: 'location',
  implemented: true,
  flags: {
    printedShroud: 4,
    printedCluesPerInvestigator: 2,
    quantity: 2,
    railIconFaces: [['east', 'south', 'west'], ['north', 'east', 'south']],
    sunken: true,
    forcedRevealDiscardUntilEnemy: true,
  },
  note: null,
  abilities: [],
}
