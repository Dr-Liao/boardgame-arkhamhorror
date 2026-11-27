// 10504 危险之旅 · 议程（writtenInRock）
// 卡面：带剧情资产的地点不能被滑动或交换。每个敌人获得猎手关键词，并在敌人阶段额外
// 结算一次猎手关键词。当敌人移动时，每个相邻地点视为与其所在地点相连。
// agendaRule 授予猎手并增加一次猎手结算。滑动、交换条件和相邻视为相连由章节 behavior 处理。
export default {
  code: '10504',
  scope: 'agenda',
  implemented: true,
  agendaRule: { enemiesGainHunter: true, extraHunterResolutions: 1 },
  flags: {
    printedDoom: 14,
    staticRules: ['protectStoryAssetLocations', 'hunterTwice', 'adjacentWhileEnemyMoving'],
    back: 'utterCollapse',
  },
  abilities: []
}
