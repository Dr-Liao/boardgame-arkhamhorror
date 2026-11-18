// 10504 危险之旅 · 议程（writtenInRock）
// 卡面：带剧情资产的地点不能被滑动或交换。每个敌人获得猎手关键词，并在敌人阶段额外
// 结算一次猎手关键词。当敌人移动时，每个相邻地点视为与其所在地点相连。
// 阶段数据（毁灭阈值 14）在 definition.stage()；三条静态规则在 definition 的 staticRules
// 与 behavior（canBeSlidOrSwapped / enemySpawned / enemyConnections）承接。
// approximation: 「额外结算一次猎手」在引擎里没有读点：只授予 hunter，
// 「敌人移动时相邻视为相连」由 behavior.enemyConnections 承接。
export default {
  code: '10504',
  scope: 'agenda',
  implemented: true,
  flags: {
    printedDoom: 14,
    staticRules: ['protectStoryAssetLocations', 'hunterTwice', 'adjacentWhileEnemyMoving'],
    back: 'utterCollapse',
  },
  note: 'approximation: 「额外结算一次猎手」无引擎读点，只能授予 hunter；其余两条静态规则已接线。',
  abilities: [],
}
