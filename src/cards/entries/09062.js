// 09062 易容术（Disguise）· 游荡者（Rogue）资产 · 0 经验 · 天赋 · 技巧 · 违法。
//
// 卡面：使用(4 补给)。
//       [action] 花费 1 补给：躲避。你本次躲避尝试得到 +2[敏捷]。如果你检定成功且躲避的敌人
//       非[[精英]]，其在下一个补给阶段期间不重整。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：躲避走 combat.js#doEvade——`bonus` 是本次检定的固定技能加值，`skipReadyRounds` /
// `skipReadyRoundsNonElite` 是「下个补给阶段不重整」的既有选项（enemy.preventReady）。
export default {
  code: '09062',
  uses: 4,
  usesType: 'supplies',
  abilities: [
    {
      kind: 'action',
      countsAs: 'evade',
      cost: { action: true, uses: 1 },
      target: { kind: 'enemy' },
      label: '花费 1 补给：躲避（+2[敏捷]）；成功且非[[精英]]则下个补给阶段不重整',
      criteria: [({ source }) => (source?.uses || 0) > 0],
      resolve: ({ inv, target, api }) => {
        if (!target) return
        api.info(`🎭 「易容术」：${inv.name} 尝试躲避「${target.name}」（+2[敏捷]）。`)
        api.evade(inv.seat, {
          enemyId: target.id,
          bonus: 2,
          skipReadyRounds: 1,
          skipReadyRoundsNonElite: true,
        })
      },
    },
  ],
  modifiers: [],
}
