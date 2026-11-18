// 10512 碱性轨道 · 地点（writtenInRock）
// 卡面：强制 - 轮末：在碱性轨道上的每位调查员与每个[[居民]]支援各承受 1 点恐惧。
// 印刷数据由 definition 的 location() 从卡表读取；轨道图标是章节几何数据（definition.RAIL_TABLE）：
// 两张实体分别是东/西（A）与北/南（B），因此 definition 里是两个实例 id 共用本卡号。
// 轮末效果在 behavior.roundEnded。
export default {
  code: '10512',
  scope: 'location',
  implemented: true,
  flags: {
    printedShroud: 3,
    printedCluesPerInvestigator: 3,
    quantity: 2,
    railIconFaces: [['east', 'west'], ['north', 'south']],
    alkaline: true,
    roundEndHorror: 1,
  },
  note: '近似：卡表把两张不同轨道图标的实体记为一个卡号（quantity 2）；definition 用 alkalineRailA/B 两个实例 id 还原 A/B 面。',
  abilities: [],
}
