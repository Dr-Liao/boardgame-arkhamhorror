// 10507 矿车 · 剧情资产（writtenInRock）
// 卡面：强制 - 敌人阶段结束时：移动矿车一次。如果它离开轨道线，每位调查员被击败并承受
// 1 点肉体创伤。[reaction] 当矿车移动时，花费 1 个道岔：取消这次移动，或额外移动一次。
// （团队每阶段最多两次。）
// 一张卡一个文件：矿车是引擎载具（mechanicState.vehicles）+ 轨道段（mechanicState.rail）。
// 强制移动读点是 behavior.enemyPhaseEnd；道岔反应在 behavior.moveMineCart。
export default {
  code: '10507',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    mineCart: true,
    vehicle: true,
    railVehicle: true,
    forcedMoveAtEnemyPhaseEnd: true,
    derailDefeatsInvestigators: true,
    switchReaction: { cost: 1, groupLimitPerPhase: 2, modes: ['cancel', 'again'] },
  },
  note: '近似：矿车「调查员不能独立移动」由 behavior.moveError 阻止，不在行动面板单独列；朝向选择走引擎 selectFacing。',
}
